// Türkçe yorum: Content DNA üretimi v2; AI destekli + fallback kural tabanlı.

import { callOpenAIChat } from "../../lib/ai/openaiClient";
import { getContentDNAPrompt } from "../../lib/ai/promptTemplates";

const SAFE_TOPICS = ["bilgilendirme", "egzersiz", "beslenme", "erken uyarı", "kontrol"];
const RISKY_PHRASES = ["kesin", "garanti", "mucize", "kurtulursun", "iyileşirsin"];

export function normalizeTone(tone = "") {
  // Türkçe yorum: Tonu sadeleştirip standardize eder; tutarlı üretim için gereklidir.
  return tone.trim().toLowerCase() || "sakin";
}

export function buildGuardrails(preferences = {}) {
  // Türkçe yorum: Sağlık içerikleri için yasaklı ifadeleri ve bilgilendirme etiketlerini döndürür.
  return {
    forbiddenClaims: RISKY_PHRASES,
    sensitiveAreas: [],
    allowedLanguageLevel: "simple",
    disclaimers: ["Bu içerik bilgilendirme amaçlıdır, tanı ve tedavi için doktorunuza başvurun."],
    preferences,
  };
}

export function generateTopics(goals = "", specialty = "") {
  // Türkçe yorum: Branş ve hedeflerden türetilen basit konu listesi; fallback.
  const base = SAFE_TOPICS.slice(0, 3);
  if (specialty) base.push(`branş:${specialty}`);
  if (goals) base.push(`hedef:${goals.slice(0, 20)}`);
  return base;
}

/**
 * Kural tabanlı fallback Content DNA üretir.
 * @param {Object} payload - Onboarding verisi
 * @returns {Object} Content DNA objesi
 */
function createContentDNAFallback(payload) {
  // Türkçe yorum: AI başarısız olursa kural tabanlı fallback kullanılır.
  const normalizedTone = normalizeTone(payload?.tone);
  const guardrails = buildGuardrails({ targetAudience: payload?.targetAudience });
  const topics = generateTopics(payload?.goals, payload?.specialty);

  return {
    normalizedTone,
    guardrails,
    topics,
    styleGuide: {
      writingStyle: "kısa ve net",
      do: ["bilgilendirici ol", "güven ver", "basit dil kullan"],
      dont: ["teşhis vaat etme", "kesin sonuç vaat etme"],
      ctaStyle: "randevu için danışın",
      disclaimerPolicy: "always",
      visualStyle: "stylized-medical",
    },
  };
}

/**
 * AI destekli Content DNA v2 üretir; başarısız olursa fallback kullanır.
 * @param {Object} onboardingData - Onboarding verisi
 * @returns {Promise<Object>} Content DNA objesi
 */
export async function createOrUpdateContentDNAFromOnboarding(onboardingData) {
  // Türkçe yorum: AI ile Content DNA üretimi denenir; başarısız olursa fallback.
  try {
    const { system, user } = getContentDNAPrompt(onboardingData);
    const result = await callOpenAIChat({
      system,
      user,
      temperature: 0.7,
      maxTokens: 1500,
      responseJson: true,
    });

    if (result.ok && result.data) {
      // Türkçe yorum: AI'den gelen veriyi validate edip default değerlerle tamamlar.
      const aiData = result.data;

      return {
        normalizedTone: aiData.normalizedTone || normalizeTone(onboardingData?.tone),
        styleGuide: {
          writingStyle: aiData.styleGuide?.writingStyle || "kısa ve net",
          do: Array.isArray(aiData.styleGuide?.do) ? aiData.styleGuide.do : ["bilgilendirici ol"],
          dont: Array.isArray(aiData.styleGuide?.dont) ? aiData.styleGuide.dont : ["teşhis vaat etme"],
          ctaStyle: aiData.styleGuide?.ctaStyle || "randevu için danışın",
          disclaimerPolicy: aiData.styleGuide?.disclaimerPolicy || "always",
          visualStyle: aiData.styleGuide?.visualStyle || "stylized-medical",
        },
        topics: Array.isArray(aiData.topics) && aiData.topics.length > 0
          ? aiData.topics
          : generateTopics(onboardingData?.goals, onboardingData?.specialty),
        guardrails: {
          forbiddenClaims: Array.isArray(aiData.guardrails?.forbiddenClaims)
            ? aiData.guardrails.forbiddenClaims
            : RISKY_PHRASES,
          sensitiveAreas: Array.isArray(aiData.guardrails?.sensitiveAreas)
            ? aiData.guardrails.sensitiveAreas
            : [],
          allowedLanguageLevel: aiData.guardrails?.allowedLanguageLevel || "simple",
        },
      };
    }
  } catch (error) {
    console.error("Content DNA AI üretimi hatası:", error);
  }

  // Türkçe yorum: AI başarısız olursa fallback kullanılır.
  return createContentDNAFallback(onboardingData);
}

/**
 * Eski createContentDNA fonksiyonu; geriye dönük uyumluluk için.
 * @param {Object} payload - Onboarding verisi
 * @returns {Object} Content DNA objesi
 */
export function createContentDNA(payload) {
  // Türkçe yorum: Eski API; fallback kullanır.
  return createContentDNAFallback(payload);
}


