// Türkçe yorum: AI prompt şablonları; Content DNA v2, metin üretimi ve governance için standart prompt'lar.

/**
 * Content DNA v2 üretimi için prompt şablonu.
 * @param {Object} onboardingData - Onboarding verisi
 * @returns {Object} { system, user }
 */
export function getContentDNAPrompt(onboardingData) {
  const system = `Sen bir sağlık içerik stratejisti AI'sın. Doktorların sosyal medya içerik üretimi için Content DNA oluşturuyorsun.
Çıktı her zaman geçerli JSON olmalı.`;

  const user = `Aşağıdaki doktor profilinden Content DNA oluştur:

Branş: ${onboardingData.specialty || "Genel"}
Hedef Kitle: ${onboardingData.targetAudience || "Genel halk"}
Ton: ${onboardingData.tone || "Sakin"}
Hedefler: ${onboardingData.goals || "Bilgilendirme"}

Şu JSON formatında döndür:
{
  "normalizedTone": "sakin|profesyonel|samimi|eğitici",
  "styleGuide": {
    "writingStyle": "kısa ve net açıklama",
    "do": ["yapılması gerekenler listesi"],
    "dont": ["yapılmaması gerekenler listesi"],
    "ctaStyle": "randevu için danışın|daha fazla bilgi için|kontrol yaptırın",
    "disclaimerPolicy": "always|conditional",
    "visualStyle": "stylized-medical|minimal-icon|illustrative-medical"
  },
  "topics": ["konu1", "konu2", "konu3"],
  "guardrails": {
    "forbiddenClaims": ["yasaklı iddialar"],
    "sensitiveAreas": ["hassas konular"],
    "allowedLanguageLevel": "simple|medium|advanced"
  }
}

Sağlık içeriği için: teşhis vaadi yok, kesin sonuç yok, yanıltıcı iddia yok. Her zaman "bilgilendirme amaçlıdır" yaklaşımı.`;

  return { system, user };
}

/**
 * Metin üretimi için prompt şablonu.
 * @param {Object} params
 * @param {string} params.topic - Konu
 * @param {Object} params.contentDNA - Content DNA objesi
 * @returns {Object} { system, user }
 */
export function getTextGenerationPrompt({ topic, contentDNA }) {
  const system = `Sen bir doktorun sosyal medya içerik üretici AI'sın. Sağlık içeriği üretiyorsun.
Kurallar:
- Teşhis vaadi yok
- Kesin sonuç vaadi yok
- Yanıltıcı iddia yok
- Bilgilendirme amaçlıdır
- Kısa, net, anlaşılır`;

  const styleGuide = contentDNA?.styleGuide || {};
  const guardrails = contentDNA?.guardrails || {};

  const user = `Konu: ${topic || "Genel sağlık bilgisi"}

Content DNA:
- Ton: ${contentDNA?.normalizedTone || "sakin"}
- Yazım Stili: ${styleGuide.writingStyle || "kısa ve net"}
- Yapılacaklar: ${(styleGuide.do || []).join(", ")}
- Yapılmayacaklar: ${(styleGuide.dont || []).join(", ")}
- CTA Stili: ${styleGuide.ctaStyle || "randevu için danışın"}
- Yasaklı İddialar: ${(guardrails.forbiddenClaims || []).join(", ")}

Şu formatta içerik üret:
1. Hook (1-2 cümle, dikkat çekici)
2. 3 madde (bullet points)
3. Kısa CTA
4. Disclaimer (${styleGuide.disclaimerPolicy === "always" ? "ekle" : "opsiyonel"})

JSON formatında döndür:
{
  "hook": "...",
  "bullets": ["...", "...", "..."],
  "text": "tam metin",
  "cta": "...",
  "disclaimer": "...",
  "scriptSentences": [
    {"t": 0, "text": "..."},
    {"t": 3, "text": "..."}
  ]
}`;

  return { system, user };
}

/**
 * Türkçe yorum: TTS için voice script üretimi; konuşma diline uygun, kısa cümleler, doğal geçişler.
 * @param {string} postText - Post metni (hook + bullets + cta)
 * @param {Object} contentDNA - Content DNA objesi
 * @returns {Object} { system, user }
 */
export function getVoiceScriptPrompt(postText, contentDNA) {
  const system = `Sen bir seslendirme script yazarısın. Post metnini doğal konuşma diline çeviriyorsun.
Kurallar:
- Kısa cümleler (maksimum 15-20 kelime)
- Konuşma dili (yazı dilinden farklı, daha samimi)
- Doğal geçişler ("Şimdi", "Örneğin", "Unutmayın ki" gibi)
- Noktalama işaretleri seslendirme için uygun
- Sayılar ve kısaltmalar açık yazılır (örn: "iki bin yirmi dört" yerine "2024" yazılmaz, "iki bin yirmi dört" yazılır)
- Teknik terimler açıklanır`;

  const tone = contentDNA?.normalizedTone || "sakin";
  const styleGuide = contentDNA?.styleGuide || {};

  const user = `Post Metni:
${postText}

Ton: ${tone}
Yazım Stili: ${styleGuide.writingStyle || "kısa ve net"}

Bu metni seslendirme için optimize edilmiş, doğal konuşma diline çevir.
Cümleleri kısalt, geçiş ifadeleri ekle, konuşma akışını düzelt.

Sadece seslendirme script'ini döndür (JSON değil, düz metin).`;

  return { system, user };
}

/**
 * Governance semantic kontrol için prompt şablonu.
 * @param {string} text - Kontrol edilecek metin
 * @param {Object} contentDNA - Content DNA objesi
 * @returns {Object} { system, user }
 */
export function getGovernanceSemanticPrompt(text, contentDNA) {
  const system = `Sen bir sağlık içerik güvenlik kontrol AI'sın. Metinlerde riskli dil, teşhis vaadi, kesin sonuç vaadi, yanıltıcı iddia arıyorsun.`;

  const guardrails = contentDNA?.guardrails || {};

  const user = `Metni kontrol et:

"${text}"

Yasaklı İddialar: ${(guardrails.forbiddenClaims || []).join(", ")}

Şu JSON formatında döndür:
{
  "verdict": "pass|warn",
  "reasons": ["neden1", "neden2"],
  "suggestedFixes": ["düzeltme1", "düzeltme2"]
}

Kurallar:
- Teşhis vaadi varsa: warn
- Kesin sonuç vaadi varsa: warn
- Yanıltıcı iddia varsa: warn
- Yasaklı iddialar varsa: warn
- Sadece bilgilendirme ise: pass`;

  return { system, user };
}

