// Türkçe yorum: Studio orchestrator'ları; pipeline'ları yönetir ve mevcut adapters'ı kullanır.
// Her adımda UsageLog kaydı yapılır, hata durumunda graceful fallback ile devam edilir.

import prisma from "../../../lib/prisma";
import { generateText, generateImage, generateAudio, generateVideo } from "./adapters";
import { riskCheck, appendDisclaimer } from "../../governance";
import { getActiveDynamicProfile } from "../../../lib/dynamicProfiles";

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
    // 1) Try to fetch per-user DynamicProfile (multi-sector, user-configured preferences)
    const dynamicProfile = await getActiveDynamicProfile(userId);

    // 2) Fetch existing ContentDNA (legacy/AI-generated)
    const cdna = await prisma.contentDNA.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });

    // 3) Merge priority: DynamicProfile.preferences override ContentDNA values when present
    let merged = null;
    if (dynamicProfile && dynamicProfile.preferences) {
      const prefs = dynamicProfile.preferences || {};
      merged = {
        normalizedTone: prefs.normalizedTone || (cdna ? cdna.normalizedTone : undefined) || "",
        styleGuide: { ...(cdna?.styleGuide || {}), ...(prefs.styleGuide || {}) },
        guardrails: { ...(cdna?.guardrails || {}), ...(prefs.guardrails || {}) },
        topics: prefs.topics || (cdna ? cdna.topics : []),
      };
    } else if (cdna) {
      merged = { ...cdna, styleGuide: cdna.styleGuide || {}, guardrails: cdna.guardrails || {} };
    } else {
      merged = null;
    }

    return merged;
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
export async function createImagePost({ userId, topic, notes = "", format, addDisclaimer = true, enhancedPrompt = null, visualDesignRequest = "" }) {
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
          enhancedPrompt: enhancedPrompt || undefined, // Revizyon için özel prompt
          visualDesignRequest: visualDesignRequest || undefined, // Kullanıcının görsel tasarım talebi
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
export async function createVideoPost({ userId, topic, notes = "", format, addDisclaimer = true, voice = "alloy", includeDisclaimerInAudio = false, requestCookie = "", visualDesignRequest = "", enhancedPrompt = null }) {
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
    const MAX_RETRIES = 3; // Her görsel için maksimum 3 deneme
    
    for (let i = 0; i < imageCount; i++) {
      let imageResult = null;
      let retryCount = 0;
      let success = false;
      
      // Her sahne için farklı odak noktası belirle
      // scriptSentences'den ilgili cümleyi al veya farklı bir açı vurgula
      const sceneSentence = scriptSentences[i]?.text || scriptSentences[Math.min(i, scriptSentences.length - 1)]?.text || "";
      const sceneFocus = sceneSentence 
        ? `${topic} - ${sceneSentence.substring(0, 50)}${sceneSentence.length > 50 ? '...' : ''}`
        : `${topic} - Sahne ${i + 1}`;
      
      // Her sahne için farklı bir perspektif veya odak noktası
      const sceneVariations = [
        "detaylı ve yakın çekim odaklı",
        "geniş açı ve bütünsel bakış açılı",
        "konsept ve sembolik temsil odaklı",
        "pratik uygulama ve adım adım odaklı",
        "duygusal ve empatik yaklaşımlı",
        "bilimsel ve teknik detay odaklı",
      ];
      const scenePerspective = sceneVariations[i % sceneVariations.length];
      
      // Retry mekanizması ile görsel üretimi
      while (retryCount < MAX_RETRIES && !success) {
        try {
          imageResult = await generateImage(
            {
              topic: sceneFocus,
              specialty: notes || "Genel",
              contentDNA,
              enhancedPrompt: enhancedPrompt ? enhancedPrompt : undefined,
              visualDesignRequest: visualDesignRequest 
                ? `${visualDesignRequest}. Bu sahne ${scenePerspective} olmalı. ${sceneSentence ? `Sahne içeriği: "${sceneSentence}"` : ''}`
                : `Bu sahne ${scenePerspective} olmalı. ${sceneSentence ? `Sahne içeriği: "${sceneSentence}"` : ''}`,
            },
            format
          );
          
          // Görsel başarıyla üretildi mi kontrol et
          if (imageResult.body?.imageUrl) {
            success = true;
            usedMock = usedMock || imageResult.usedMock;
            images.push({
              url: imageResult.body.imageUrl,
              prompt: imageResult.body?.usedPrompt || "",
              sceneIndex: i + 1,
              meta: imageResult.body?.meta || {},
            });
            await logUsage(
              userId,
              "image",
              imageResult.usedMock ? "mock" : "gemini",
              true,
              Date.now() - imageStart
            );
            logDebug(debugId, `image_${i + 1}`, { ok: true, usedMock: !!imageResult.usedMock, retryCount });
          } else {
            // Görsel üretilemedi, retry yap
            retryCount++;
            if (retryCount < MAX_RETRIES) {
              console.log(`[studio][${debugId}] Görsel ${i + 1} üretilemedi, ${retryCount}/${MAX_RETRIES} deneme yapılıyor...`);
              await new Promise(resolve => setTimeout(resolve, 2000)); // 2 saniye bekle
            }
          }
        } catch (error) {
          retryCount++;
          if (retryCount >= MAX_RETRIES) {
            errors.push({ step: `Görsel ${i + 1} üretimi`, message: error.message || "Görsel üretilemedi (3 deneme başarısız)" });
            logDebug(debugId, `image_${i + 1}`, { ok: false, error: error.message, retryCount });
          } else {
            console.log(`[studio][${debugId}] Görsel ${i + 1} üretim hatası, ${retryCount}/${MAX_RETRIES} deneme yapılıyor...`, error.message);
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 saniye bekle
          }
        }
      }
      
      // Eğer tüm denemeler başarısız olduysa
      if (!success) {
        errors.push({ step: `Görsel ${i + 1} üretimi`, message: `Görsel üretilemedi (${MAX_RETRIES} deneme başarısız)` });
        logDebug(debugId, `image_${i + 1}`, { ok: false, retryCount: MAX_RETRIES });
        // Boş görsel ekleme - sadece hata kaydet
      }
    }

    // 6) Ses üretimi - Retry mekanizması ile
    const audioStart = Date.now();
    let audioResult;
    const MAX_AUDIO_RETRIES = 3; // Maksimum 3 deneme
    let audioRetryCount = 0;
    let audioSuccess = false;
    
    // Türkçe yorum: voiceScript varsa onu kullan (TTS için optimize edilmiş), yoksa finalText.
    const textForAudio = textResult.body?.voiceScript || finalText;
    
    while (audioRetryCount < MAX_AUDIO_RETRIES && !audioSuccess) {
      try {
        audioResult = await generateAudio({
          text: finalText,
          voiceScript: textForAudio,
          topic,
          contentDNA,
          voice, // Türkçe yorum: Kullanıcının seçtiği voice.
          includeDisclaimer: includeDisclaimerInAudio, // Türkçe yorum: Disclaimer seslendirilsin mi?
          disclaimer: addDisclaimer && textResult.body?.disclaimer ? textResult.body.disclaimer : undefined,
        });
        
        // Ses başarıyla üretildi mi kontrol et
        if (audioResult.body?.audioUrl) {
          audioSuccess = true;
          usedMock = usedMock || audioResult.usedMock;
          await logUsage(userId, "audio", audioResult.usedMock ? "mock" : "openai", true, Date.now() - audioStart);
          logDebug(debugId, "audio", { ok: true, usedMock: !!audioResult.usedMock, ms: Date.now() - audioStart, voice, retryCount: audioRetryCount });
        } else {
          // Ses üretilemedi, retry yap
          audioRetryCount++;
          if (audioRetryCount < MAX_AUDIO_RETRIES) {
            console.log(`[studio][${debugId}] Ses üretilemedi, ${audioRetryCount}/${MAX_AUDIO_RETRIES} deneme yapılıyor...`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 saniye bekle
          }
        }
      } catch (error) {
        audioRetryCount++;
        if (audioRetryCount >= MAX_AUDIO_RETRIES) {
          errors.push({ step: "Ses üretimi", message: error.message || `Ses üretilemedi (${MAX_AUDIO_RETRIES} deneme başarısız)` });
          await logUsage(userId, "audio", "unknown", false, Date.now() - audioStart, "AUDIO_GEN_ERROR");
          logDebug(debugId, "audio", { ok: false, ms: Date.now() - audioStart, message: error?.message, retryCount: audioRetryCount });
          audioResult = {
            body: {
              audioUrl: null,
              transcript: finalText,
              fallback: true,
            },
            usedMock: true,
          };
        } else {
          console.log(`[studio][${debugId}] Ses üretim hatası, ${audioRetryCount}/${MAX_AUDIO_RETRIES} deneme yapılıyor...`, error.message);
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 saniye bekle
        }
      }
    }
    
    // Eğer tüm denemeler başarısız olduysa
    if (!audioSuccess) {
      errors.push({ step: "Ses üretimi", message: `Ses üretilemedi (${MAX_AUDIO_RETRIES} deneme başarısız)` });
      logDebug(debugId, "audio", { ok: false, retryCount: MAX_AUDIO_RETRIES });
      if (!audioResult) {
        audioResult = {
          body: {
            audioUrl: null,
            transcript: finalText,
            fallback: true,
          },
          usedMock: true,
        };
      }
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

