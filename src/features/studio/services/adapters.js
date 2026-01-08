// Türkçe yorum: AI entegrasyonları için tak-çıkar adapterler; gerçek API + mock fallback.

import { callOpenAIChat } from "../../../lib/ai/openaiClient";
import { getTextGenerationPrompt, getVoiceScriptPrompt } from "../../../lib/ai/promptTemplates";
import { createImage } from "../../../lib/ai/nanoBananaClient";
import { synthesize } from "../../../lib/ai/openaiTtsClient";
import prisma from "../../../lib/prisma";

/**
 * @typedef {Object} GenerationResult
 * @property {string} title
 * @property {Object} body
 * @property {Object} cdnaSnapshot
 * @property {boolean} [usedMock] - Mock kullanıldıysa true
 */

const baseCdna = {
  tone: "sakin",
  guardrails: ["riskli dil kullanma", "bilgilendirme amaçlıdır"],
};

/**
 * Metin üretimi; OpenAI ile gerçek üretim, başarısız olursa mock.
 * @param {Object} input
 * @param {string} input.topic - Konu
 * @param {string} input.specialty - Branş
 * @param {Object} input.contentDNA - Content DNA objesi
 * @returns {Promise<GenerationResult>}
 */
export async function generateText(input) {
  // Türkçe yorum: OpenAI ile metin üretimi denenir; başarısız olursa mock.
  try {
    const { system, user } = getTextGenerationPrompt({
      topic: input?.topic || "Genel sağlık bilgisi",
      contentDNA: input?.contentDNA,
    });

    const result = await callOpenAIChat({
      system,
      user,
      temperature: 0.7,
      maxTokens: 1000,
      responseJson: true,
    });

    if (result.ok && result.data) {
      const aiData = result.data;

      // Türkçe yorum: AI'den gelen veriyi formatla.
      const fullText = [
        aiData.hook || "",
        (aiData.bullets || []).map((b) => `• ${b}`).join("\n"),
        aiData.cta || "",
        aiData.disclaimer || "",
      ]
        .filter(Boolean)
        .join("\n\n");

      // Türkçe yorum: TTS için ayrı voice script üretimi; daha doğal konuşma dili.
      let voiceScript = fullText; // Fallback olarak post metni kullanılır.
      try {
        const { system: voiceSystem, user: voiceUser } = getVoiceScriptPrompt(fullText, input?.contentDNA);
        const voiceResult = await callOpenAIChat({
          system: voiceSystem,
          user: voiceUser,
          temperature: 0.8, // Türkçe yorum: Daha yaratıcı, doğal geçişler için.
          maxTokens: 800,
          responseJson: false, // Türkçe yorum: Düz metin döner, JSON değil.
        });

        if (voiceResult.ok && voiceResult.data) {
          voiceScript = voiceResult.data.trim();
        }
      } catch (error) {
        console.warn("Voice script üretimi başarısız, post metni kullanılıyor:", error);
        // Türkçe yorum: Voice script başarısız olursa post metni kullanılır.
      }

      return {
        title: `Hasta eğitimi - ${input?.specialty || "Genel"}`,
        body: {
          hook: aiData.hook || "",
          bullets: Array.isArray(aiData.bullets) ? aiData.bullets : [],
          text: fullText,
          cta: aiData.cta || "",
          disclaimer: aiData.disclaimer || "",
          voiceScript, // Türkçe yorum: TTS için optimize edilmiş metin.
          scriptSentences: Array.isArray(aiData.scriptSentences)
            ? aiData.scriptSentences
            : [{ t: 0, text: fullText }],
        },
        cdnaSnapshot: input?.contentDNA || baseCdna,
        usedMock: false,
      };
    }
  } catch (error) {
    console.error("Metin üretimi hatası:", error);
  }

  // Türkçe yorum: Mock fallback.
  return {
    title: "Hasta eğitimi - " + (input?.specialty || "Genel"),
    body: {
      hook: `Bugün ${input?.topic || "sağlık"} hakkında kısa bilgiler paylaşıyorum.`,
      bullets: [
        "Düzenli kontrollerinizi ihmal etmeyin",
        "Sağlıklı yaşam tarzı benimseyin",
        "Belirtilerde doktorunuza danışın",
      ],
      text: `Bugün ${input?.topic || "sağlık"} hakkında kısa bilgiler paylaşıyorum. Düzenli kontrollerinizi ihmal etmeyin.`,
      cta: "Randevu için doktorunuza danışın",
      disclaimer: "Bilgilendirme amaçlıdır; tanı ve tedavi için hekiminize danışın.",
      voiceScript: `Merhaba. Bugün ${input?.topic || "sağlık"} konusunda birkaç önemli bilgi paylaşmak istiyorum. Öncelikle, düzenli kontrollerinizi asla ihmal etmeyin. İkinci olarak, sağlıklı bir yaşam tarzı benimseyin. Son olarak, herhangi bir belirti görürseniz mutlaka doktorunuza danışın. Randevu almak için doktorunuza ulaşabilirsiniz.`,
      scriptSentences: [{ t: 0, text: `Bugün ${input?.topic || "sağlık"} hakkında kısa bilgiler paylaşıyorum.` }],
    },
    cdnaSnapshot: input?.contentDNA || baseCdna,
    usedMock: true,
  };
}

/**
 * Görsel üretimi; Nano Banana ile gerçek üretim, başarısız olursa mock.
 * @param {Object} input
 * @param {string} input.topic - Konu
 * @param {string} input.specialty - Branş
 * @param {Object} input.contentDNA - Content DNA objesi
 * @param {string} format - "9:16" veya "16:9"
 * @returns {Promise<GenerationResult>}
 */
export async function generateImage(input, format = "9:16") {
  // Türkçe yorum: Google Gemini ile görsel üretimi denenir; başarısız olursa mock.
  try {
    const contentDNA = input?.contentDNA || {};
    const styleGuide = contentDNA.styleGuide || {};
    const visualStyle = styleGuide.visualStyle || "stylized-medical";
    const preferredTags = styleGuide.visualTags || [];
    const styleNotes = (contentDNA?.styleGuide?.styleSummary || "") + " " + (contentDNA?.styleGuide?.notes || "");
    const tone = contentDNA.normalizedTone || "sakin";

    // Türkçe yorum: Content DNA'dan prompt türetilir; ham prompt yok.
    const prompt = `Stilize ama güven veren, abartısız, medikal temalı illüstratif kompozisyon. 
Tema: ${input?.topic || "sağlık bilgisi"}. 
Branş: ${input?.specialty || "genel"}. 
Ton: ${tone}. 
Görsel stili: ${visualStyle}. 
Tercih edilen etiketler: ${(preferredTags || []).join(", ")}. 
Stil notları: ${styleNotes?.trim() || "yok"}. 
Doktor portresi yok, klinik birebir görsel yok. 
Oran: ${format}.`;

    const result = await createImage({ prompt, format });

      if (result.ok && result.imageUrl) {
        return {
          title: `Görsel (${format})`,
          body: {
            imageUrl: result.imageUrl,
            usedPrompt: result.usedPrompt,
            format,
            meta: result.meta || {},
          },
          cdnaSnapshot: input?.contentDNA || baseCdna,
          usedMock: false,
        };
      } else {
        // Türkçe yorum: Gemini başarısız olursa placeholder + prompt ile fallback.
        return {
          title: `Görsel Taslak (${format})`,
          body: {
            imageUrl: null,
            usedPrompt: result.usedPrompt || prompt,
            format,
            meta: {
              ...result.meta,
              fallback: true,
              message: result.message || "Görsel üretilemedi",
            },
          },
          cdnaSnapshot: input?.contentDNA || baseCdna,
          usedMock: true,
        };
      }
  } catch (error) {
    console.error("Görsel üretimi hatası:", error);
  }

  // Türkçe yorum: Mock fallback.
  return {
    title: `Görsel Taslak (${format})`,
    body: {
      prompt: `Doktor için güven verici görsel, oran ${format}, tema ${input?.topic || "bilgilendirme"}`,
      imageUrl: null,
      format,
    },
    cdnaSnapshot: input?.contentDNA || baseCdna,
    usedMock: true,
  };
}

/**
 * Ses üretimi; OpenAI TTS ile gerçek üretim, başarısız olursa mock.
 * @param {Object} input
 * @param {string} input.text - Seslendirilecek metin (text generation'dan gelir)
 * @param {string} input.voiceScript - TTS için optimize edilmiş metin (voiceScript öncelikli)
 * @param {string} input.topic - Konu
 * @param {string} [input.voice] - Ses seçeneği (alloy, echo, fable, onyx, nova, shimmer)
 * @param {boolean} [input.includeDisclaimer=false] - Disclaimer seslendirilsin mi
 * @param {string} [input.disclaimer] - Disclaimer metni
 * @returns {Promise<GenerationResult>}
 */
export async function generateAudio(input) {
  // Türkçe yorum: OpenAI TTS ile ses üretimi denenir; başarısız olursa mock.
  try {
    // Türkçe yorum: voiceScript varsa onu kullan (TTS için optimize edilmiş), yoksa text kullan.
    let textToSpeak = input?.voiceScript || input?.text || `Merhaba, bugün ${input?.topic || "sağlık"} konusunda birkaç ipucu paylaşıyorum.`;

    // Türkçe yorum: Disclaimer ekleme (opsiyonel).
    if (input?.includeDisclaimer && input?.disclaimer) {
      textToSpeak = `${textToSpeak} ${input.disclaimer}`;
    }

    const result = await synthesize({ text: textToSpeak, voice: input?.voice });

    if (result.ok && result.audioUrl) {
      return {
        title: "Ses İçeriği",
        body: {
          audioUrl: result.audioUrl,
          transcript: result.transcript || textToSpeak,
          meta: result.meta || {},
        },
        cdnaSnapshot: input?.contentDNA || baseCdna,
        usedMock: false,
      };
    }
  } catch (error) {
    console.error("Ses üretimi hatası:", error);
  }

  // Türkçe yorum: Mock fallback.
  return {
    title: "Ses İçeriği Taslağı",
    body: {
      transcript: `Merhaba, bugün ${input?.topic || "sağlık"} konusunda birkaç ipucu paylaşıyorum.`,
      audioUrl: null,
    },
    cdnaSnapshot: input?.contentDNA || baseCdna,
    usedMock: true,
  };
}

/**
 * Video üretimi; timeline + captions. FFmpeg render opsiyonel.
 * @param {Object} input
 * @param {string} input.topic - Konu
 * @param {Object} input.textResult - Text generation sonucu (scriptSentences için)
 * @param {Object} input.audioResult - Audio generation sonucu (duration için)
 * @returns {Promise<GenerationResult>}
 */
export async function generateVideo(input) {
  // Türkçe yorum: Video timeline üretimi; render mode'a göre videoUrl eklenir.
  const scriptSentences = input?.textResult?.body?.scriptSentences || [
    { t: 0, text: `Bugün ${input?.topic || "sağlık"} hakkında kısa bir bilgilendirme yapıyorum.` },
  ];

  // Türkçe yorum: Scene süreleri scriptSentences'den hesaplanır (basit heuristic).
  const timeline = scriptSentences.map((sentence, index) => {
    const wordCount = sentence.text.split(" ").length;
    // Türkçe yorum: Ortalama 3 kelime/saniye hızında konuşma varsayılır.
    const duration = Math.max(3, Math.ceil(wordCount / 3));
    const startTime = index === 0 ? 0 : scriptSentences.slice(0, index).reduce((sum, s) => {
      const wc = s.text.split(" ").length;
      return sum + Math.max(3, Math.ceil(wc / 3));
    }, 0);

    return {
      scene: index + 1,
      startTime,
      duration,
      caption: sentence.text,
    };
  });

  const totalDuration = timeline.reduce((sum, scene) => sum + scene.duration, 0);
  const script = scriptSentences.map((s) => s.text).join(" ");

  // Türkçe yorum: Render mode kontrolü; FFmpeg varsa render edilir, yoksa mock videoUrl.
  const renderMode = process.env.VIDEO_RENDER_MODE || "mock";
  let videoUrl = null;

  if (renderMode === "ffmpeg") {
    try {
      // Türkçe yorum: FFmpeg render API'sine gerekli girdiler hazırlanır.
      const images =
        (Array.isArray(input?.images) ? input.images : [])
          .filter(Boolean)
          .map((img, idx) => (typeof img === "string" ? { url: img, sceneIndex: idx + 1 } : img));

      const captions = timeline.map((s) => ({
        start: s.startTime,
        end: s.startTime + s.duration,
        text: s.caption,
      }));

      const audioDataUrl = input?.audioResult?.body?.audioUrl || null;
      const format = input?.format || "9:16";

      const res = await fetch("/api/video/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images, timeline, captions, audioDataUrl, format }),
      });

      if (res.ok) {
        const data = await res.json();
        videoUrl = data?.videoUrl || null;
      } else {
        // Türkçe yorum: FFmpeg yoksa veya render hatası varsa mock'a düşülür.
        const err = await res.json().catch(() => ({}));
        console.warn("FFmpeg render başarısız:", err?.message || res.statusText);
      }
    } catch (e) {
      console.warn("FFmpeg render çağrısı hatası:", e);
    }
  }

  return {
    title: "Video",
    body: {
      timeline,
      script,
      totalDuration,
      videoUrl,
      renderMode,
    },
    cdnaSnapshot: input?.contentDNA || baseCdna,
    usedMock: renderMode === "mock",
  };
}


