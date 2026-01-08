// Türkçe yorum: Studio orchestrator'ları; pipeline'ları yönetir ve mevcut adapters'ı kullanır.
// Her adımda UsageLog kaydı yapılır, hata durumunda graceful fallback ile devam edilir.

import prisma from "../../../lib/prisma";
import { generateText, generateImage, generateAudio, generateVideo } from "./adapters";
import { riskCheck, appendDisclaimer } from "../../governance";

// Türkçe yorum: Debug logları geliştirme sırasında teşhis için kullanılır.
// Prod ortamında istenirse STUDIO_DEBUG=0 ile kapatılabilir.
const DEBUG_ENABLED = process.env.STUDIO_DEBUG === "1" || process.env.NODE_ENV !== "production";

function nowIso() {
  return new Date().toISOString();
}

function logDebug(debugId, step, data) {
  if (!DEBUG_ENABLED) return;
  // Türkçe yorum: Base64 gibi devasa alanları loglamıyoruz.
  const safe = data ? JSON.parse(JSON.stringify(data, (k, v) => (typeof v === "string" && v.startsWith("data:") ? `[dataUrl len=${v.length}]` : v))) : undefined;
  console.log(`[studio][${debugId}][${step}] ${nowIso()}`, safe || "");
}

function genDebugId(prefix = "dbg") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Türkçe yorum: UsageLog kaydı için yardımcı fonksiyon; hata olsa bile devam eder.
 * @param {string} userId - Kullanıcı ID
 * @param {string} actionType - İşlem tipi (text, image, audio, video, cdna, governance)
 * @param {string} provider - Provider (openai, gemini, mock, vb.)
 * @param {boolean} success - Başarılı mı
 * @param {number} durationMs - Süre (ms)
 * @param {string} [errorCode] - Hata kodu (varsa)
 */
async function logUsage(userId, actionType, provider, success, durationMs, errorCode = null) {
  try {
    await prisma.usageLog.create({
      data: {
        userId,
        actionType,
        provider: provider || "unknown",
        success,
        durationMs,
        errorCode,
      },
    });
  } catch (error) {
    // Türkçe yorum: Log hatası pipeline'ı durdurmaz.
    console.error("UsageLog kayıt hatası:", error);
  }
}

/**
 * Türkçe yorum: ContentDNA'yı kullanıcı için fetch eder.
 * @param {string} userId - Kullanıcı ID
 * @returns {Promise<Object|null>} ContentDNA objesi veya null
 */
async function fetchContentDNA(userId) {
  try {
    const cdna = await prisma.contentDNA.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
    return cdna ? { ...cdna, styleGuide: cdna.styleGuide || {}, guardrails: cdna.guardrails || {} } : null;
  } catch (error) {
    console.error("ContentDNA fetch hatası:", error);
    return null;
  }
}

/**
 * Türkçe yorum: Görsel post hazırlama pipeline'ı.
 * @param {Object} params
 * @param {string} params.userId - Kullanıcı ID
 * @param {string} params.topic - Konu
 * @param {string} [params.notes] - Not/branş bilgisi
 * @param {string} params.format - "9:16" veya "16:9"
 * @param {boolean} [params.addDisclaimer=true] - Disclaimer ekle
 * @returns {Promise<{success: boolean, asset?: Object, errors?: Array, usedMock?: boolean}>}
 */
export async function createImagePost({ userId, topic, notes = "", format, addDisclaimer = true }) {
  const debugId = genDebugId("imgpost");
  const startTime = Date.now();
  const errors = [];
  let usedMock = false;

  logDebug(debugId, "start", { userId, topic, format, addDisclaimer, notesLen: (notes || "").length });
  try {
    // 1) ContentDNA fetch
    const cdnaStart = Date.now();
    const contentDNA = await fetchContentDNA(userId);
    await logUsage(userId, "cdna", "db", !!contentDNA, Date.now() - cdnaStart);
    logDebug(debugId, "cdna", { ok: !!contentDNA, ms: Date.now() - cdnaStart });

    if (!contentDNA) {
      return {
        success: false,
        errors: ["ContentDNA bulunamadı. Lütfen onboarding'i tamamlayın."],
        debugId,
      };
    }

    // 2) Metin üretimi
    const textStart = Date.now();
    let textResult;
    try {
      textResult = await generateText({
        topic,
        specialty: notes || "Genel",
        contentDNA,
      });
      usedMock = usedMock || textResult.usedMock;
      await logUsage(userId, "text", textResult.usedMock ? "mock" : "openai", true, Date.now() - textStart);
      logDebug(debugId, "text", { ok: true, usedMock: !!textResult.usedMock, ms: Date.now() - textStart });
    } catch (error) {
      errors.push({ step: "Metin üretimi", message: error.message || "Metin üretilemedi" });
      await logUsage(userId, "text", "unknown", false, Date.now() - textStart, "TEXT_GEN_ERROR");
      logDebug(debugId, "text", { ok: false, ms: Date.now() - textStart, message: error?.message });
      // Türkçe yorum: Metin üretimi başarısız olursa pipeline durur.
      return { success: false, errors, debugId };
    }

    // 3) Governance kontrolü
    const govStart = Date.now();
    let safety = { verdict: "pass", reasons: [], suggestedFixes: [] };
    try {
      const textForCheck = textResult.body?.text || "";
      safety = await riskCheck(textForCheck, contentDNA);
      await logUsage(userId, "governance", safety.verdict === "pass" ? "keyword" : "openai", true, Date.now() - govStart);
      logDebug(debugId, "governance", { verdict: safety.verdict, ms: Date.now() - govStart, reasonsCount: (safety.reasons || []).length });
    } catch (error) {
      console.error("Governance kontrolü hatası:", error);
      await logUsage(userId, "governance", "unknown", false, Date.now() - govStart, "GOV_ERROR");
      logDebug(debugId, "governance", { ok: false, ms: Date.now() - govStart, message: error?.message });
      // Türkçe yorum: Governance hatası pipeline'ı durdurmaz, pass olarak devam eder.
    }

    // 4) Disclaimer ekleme (gerekiyorsa)
    let finalText = textResult.body?.text || "";
    if (addDisclaimer && safety.verdict === "pass") {
      const policy = contentDNA.styleGuide?.disclaimerPolicy || "always";
      finalText = appendDisclaimer(finalText, policy);
    }

    // 5) Görsel üretimi
    const imageStart = Date.now();
    let imageResult;
    try {
      imageResult = await generateImage(
        {
          topic,
          specialty: notes || "Genel",
          contentDNA,
        },
        format
      );
      usedMock = usedMock || imageResult.usedMock;
      await logUsage(
        userId,
        "image",
        imageResult.usedMock ? "mock" : "gemini",
        !!imageResult.body?.imageUrl,
        Date.now() - imageStart
      );
      logDebug(debugId, "image", { ok: !!imageResult.body?.imageUrl, usedMock: !!imageResult.usedMock, ms: Date.now() - imageStart });
    } catch (error) {
      errors.push({ step: "Görsel üretimi", message: error.message || "Görsel üretilemedi" });
      await logUsage(userId, "image", "unknown", false, Date.now() - imageStart, "IMAGE_GEN_ERROR");
      logDebug(debugId, "image", { ok: false, ms: Date.now() - imageStart, message: error?.message });
      // Türkçe yorum: Görsel başarısız olsa bile placeholder ile devam edilir.
      imageResult = {
        body: {
          imageUrl: null,
          usedPrompt: `Görsel üretilemedi: ${topic}`,
          format,
          fallback: true,
        },
        usedMock: true,
      };
    }

    // 6) Asset oluşturma
    const assetPayload = {
      // Türkçe yorum: Bundle yapısı; metin ve görsel birlikte.
      text: {
        hook: textResult.body?.hook || "",
        bullets: textResult.body?.bullets || [],
        text: finalText,
        cta: textResult.body?.cta || "",
        disclaimer: addDisclaimer ? (contentDNA.styleGuide?.disclaimerPolicy === "always" ? "Bilgilendirme amaçlıdır." : "") : "",
      },
      image: {
        imageUrl: imageResult.body?.imageUrl,
        usedPrompt: imageResult.body?.usedPrompt || "",
        format,
        meta: imageResult.body?.meta || {},
      },
      bundle: true, // Türkçe yorum: Bu bir bundle post.
    };

    // Türkçe yorum: Asset kaydı API route üzerinden yapılır (rate limit + log dahil).
    // Burada sadece payload hazırlanır, kayıt client tarafından yapılır.

    return {
      success: true,
      asset: {
        type: "imagePost",
        title: `Görsel Post - ${topic}`,
        body: assetPayload,
        cdnaSnapshot: contentDNA,
        safety,
        usedMock,
      },
      errors: errors.length > 0 ? errors : undefined,
      usedMock,
      debugId,
    };
  } catch (error) {
    console.error("createImagePost hatası:", error);
    await logUsage(userId, "imagePost", "unknown", false, Date.now() - startTime, "PIPELINE_ERROR");
    return {
      success: false,
      errors: [{ step: "Pipeline", message: error.message || "Bilinmeyen hata" }],
      debugId,
    };
  }
}

/**
 * Türkçe yorum: Video post hazırlama pipeline'ı.
 * @param {Object} params
 * @param {string} params.userId - Kullanıcı ID
 * @param {string} params.topic - Konu
 * @param {string} [params.notes] - Not/branş bilgisi
 * @param {string} params.format - "9:16" veya "16:9"
 * @param {boolean} [params.addDisclaimer=true] - Disclaimer ekle
 * @returns {Promise<{success: boolean, asset?: Object, errors?: Array, usedMock?: boolean}>}
 */
export async function createVideoPost({ userId, topic, notes = "", format, addDisclaimer = true, voice = "alloy", includeDisclaimerInAudio = false, requestCookie = "" }) {
  const debugId = genDebugId("videopost");
  const startTime = Date.now();
  const errors = [];
  let usedMock = false;

  logDebug(debugId, "start", { userId, topic, format, addDisclaimer, voice, includeDisclaimerInAudio, notesLen: (notes || "").length });
  try {
    // 1) ContentDNA fetch
    const cdnaStart = Date.now();
    const contentDNA = await fetchContentDNA(userId);
    await logUsage(userId, "cdna", "db", !!contentDNA, Date.now() - cdnaStart);
    logDebug(debugId, "cdna", { ok: !!contentDNA, ms: Date.now() - cdnaStart });

    if (!contentDNA) {
      return {
        success: false,
        errors: ["ContentDNA bulunamadı. Lütfen onboarding'i tamamlayın."],
        debugId,
      };
    }

    // 2) Metin üretimi
    const textStart = Date.now();
    let textResult;
    try {
      textResult = await generateText({
        topic,
        specialty: notes || "Genel",
        contentDNA,
      });
      usedMock = usedMock || textResult.usedMock;
      await logUsage(userId, "text", textResult.usedMock ? "mock" : "openai", true, Date.now() - textStart);
      logDebug(debugId, "text", { ok: true, usedMock: !!textResult.usedMock, ms: Date.now() - textStart });
    } catch (error) {
      errors.push({ step: "Metin üretimi", message: error.message || "Metin üretilemedi" });
      await logUsage(userId, "text", "unknown", false, Date.now() - textStart, "TEXT_GEN_ERROR");
      logDebug(debugId, "text", { ok: false, ms: Date.now() - textStart, message: error?.message });
      return { success: false, errors };
    }

    // 3) Governance kontrolü
    const govStart = Date.now();
    let safety = { verdict: "pass", reasons: [], suggestedFixes: [] };
    try {
      const textForCheck = textResult.body?.text || "";
      safety = await riskCheck(textForCheck, contentDNA);
      await logUsage(userId, "governance", safety.verdict === "pass" ? "keyword" : "openai", true, Date.now() - govStart);
      logDebug(debugId, "governance", { verdict: safety.verdict, ms: Date.now() - govStart, reasonsCount: (safety.reasons || []).length });
    } catch (error) {
      console.error("Governance kontrolü hatası:", error);
      await logUsage(userId, "governance", "unknown", false, Date.now() - govStart, "GOV_ERROR");
      logDebug(debugId, "governance", { ok: false, ms: Date.now() - govStart, message: error?.message });
    }

    // 4) Disclaimer ekleme
    let finalText = textResult.body?.text || "";
    if (addDisclaimer && safety.verdict === "pass") {
      const policy = contentDNA.styleGuide?.disclaimerPolicy || "always";
      finalText = appendDisclaimer(finalText, policy);
    }

    // 5) Görsel üretimi (3-6 görsel, metin uzunluğuna göre)
    const scriptSentences = textResult.body?.scriptSentences || [];
    const sentenceCount = scriptSentences.length;
    // Türkçe yorum: Kısa metin (1-3 cümle) = 3 görsel, orta (4-6) = 4-5, uzun (7+) = 6.
    const imageCount = sentenceCount <= 3 ? 3 : sentenceCount <= 6 ? Math.min(5, sentenceCount) : 6;

    const images = [];
    const imageStart = Date.now();
    for (let i = 0; i < imageCount; i++) {
      try {
        const imageResult = await generateImage(
          {
            topic: `${topic} - Sahne ${i + 1}`,
            specialty: notes || "Genel",
            contentDNA,
          },
          format
        );
        usedMock = usedMock || imageResult.usedMock;
        images.push({
          url: imageResult.body?.imageUrl,
          prompt: imageResult.body?.usedPrompt || "",
          sceneIndex: i + 1,
          meta: imageResult.body?.meta || {},
        });
        await logUsage(
          userId,
          "image",
          imageResult.usedMock ? "mock" : "gemini",
          !!imageResult.body?.imageUrl,
          Date.now() - imageStart
        );
        logDebug(debugId, `image_${i + 1}`, { ok: !!imageResult.body?.imageUrl, usedMock: !!imageResult.usedMock });
      } catch (error) {
        errors.push({ step: `Görsel ${i + 1} üretimi`, message: error.message || "Görsel üretilemedi" });
        logDebug(debugId, `image_${i + 1}`, { ok: false, message: error?.message });
        images.push({
          url: null,
          prompt: `Görsel üretilemedi: ${topic} - Sahne ${i + 1}`,
          sceneIndex: i + 1,
          fallback: true,
        });
      }
    }

    // 6) Ses üretimi
    const audioStart = Date.now();
    let audioResult;
    try {
      // Türkçe yorum: voiceScript varsa onu kullan (TTS için optimize edilmiş), yoksa finalText.
      const textForAudio = textResult.body?.voiceScript || finalText;
      audioResult = await generateAudio({
        text: finalText,
        voiceScript: textForAudio,
        topic,
        contentDNA,
        voice, // Türkçe yorum: Kullanıcının seçtiği voice.
        includeDisclaimer: includeDisclaimerInAudio, // Türkçe yorum: Disclaimer seslendirilsin mi?
        disclaimer: addDisclaimer && textResult.body?.disclaimer ? textResult.body.disclaimer : undefined,
      });
      usedMock = usedMock || audioResult.usedMock;
      await logUsage(userId, "audio", audioResult.usedMock ? "mock" : "openai", !!audioResult.body?.audioUrl, Date.now() - audioStart);
      logDebug(debugId, "audio", { ok: !!audioResult.body?.audioUrl, usedMock: !!audioResult.usedMock, ms: Date.now() - audioStart, voice });
    } catch (error) {
      errors.push({ step: "Ses üretimi", message: error.message || "Ses üretilemedi" });
      await logUsage(userId, "audio", "unknown", false, Date.now() - audioStart, "AUDIO_GEN_ERROR");
      logDebug(debugId, "audio", { ok: false, ms: Date.now() - audioStart, message: error?.message });
      audioResult = {
        body: {
          audioUrl: null,
          transcript: finalText,
          fallback: true,
        },
        usedMock: true,
      };
    }

    // 7) Video timeline hesapla (adapters.generateVideo ile)
    const videoStart = Date.now();
    const videoBase = await generateVideo({
      topic,
      textResult,
      audioResult,
      images,
      format,
      contentDNA,
    });

    // 8) Kullanıcı isteği: MP4 zorunluluğu kaldırıldı. Parçalı çıktı dönüyoruz (metin+görsel+ses+captions).
    await logUsage(userId, "video", "compose", true, Date.now() - videoStart);

    // 9) Captions oluşturma (timeline'dan)
    const captions = (videoBase?.body?.timeline || []).map((scene) => ({
      start: scene.startTime,
      end: scene.startTime + scene.duration,
      text: scene.caption || "",
    }));

    // 10) Parçalı asset payload
    const assetPayload = {
      type: "videoParts",
      format,
      duration: videoBase?.body?.totalDuration || 0,
      text: {
        hook: textResult.body?.hook || "",
        bullets: textResult.body?.bullets || [],
        text: finalText,
        cta: textResult.body?.cta || "",
        disclaimer: textResult.body?.disclaimer || "",
        voiceScript: textResult.body?.voiceScript || finalText,
      },
      images: images.map((i) => ({
        url: i.url || null,
        prompt: i.prompt || "",
        sceneIndex: i.sceneIndex || 0,
        meta: i.meta || {},
      })),
      audio: {
        audioUrl: audioResult?.body?.audioUrl || null,
        transcript: audioResult?.body?.transcript || finalText,
        meta: audioResult?.body?.meta || {},
      },
      captions,
    };

    return {
      success: true,
      asset: {
        type: "videoParts",
        title: `Video Parçaları - ${topic}`,
        body: assetPayload,
        cdnaSnapshot: contentDNA,
        safety,
        usedMock,
      },
      errors: errors.length > 0 ? errors : undefined,
      usedMock,
      debugId,
    };
  } catch (error) {
    console.error("createVideoPost hatası:", error);
    await logUsage(userId, "videoPost", "unknown", false, Date.now() - startTime, "PIPELINE_ERROR");
    return {
      success: false,
      errors: [{ step: "Pipeline", message: error.message || "Bilinmeyen hata" }],
      debugId,
    };
  }
}

