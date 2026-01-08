// Türkçe yorum: AI prompt şablonları; Content DNA v2, metin üretimi ve governance için standart prompt'lar.

/**
 * Content DNA v2 üretimi için prompt şablonu.
 * @param {Object} onboardingData - Onboarding verisi
 * @returns {Object} { system, user }
 */
export function getContentDNAPrompt(onboardingData) {
  const system = `Sen bir içerik stratejisti AI'sın. Kullanıcının sektörüne uygun Content DNA oluşturuyorsun. Çıktı her zaman geçerli JSON olmalı.`;

  const sectorLabel = onboardingData.sector || onboardingData.specialty || "Genel";
  const user = `Aşağıdaki profil bilgisine göre Content DNA oluştur:

Sektör/Branş: ${sectorLabel}
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
    "ctaStyle": "harekete geçirici çağrı biçimi",
    "disclaimerPolicy": "always|conditional",
    "visualStyle": "stil tercihi örn: minimal|illustrative|photoreal"
  },
  "topics": ["konu1", "konu2", "konu3"],
  "guardrails": {
    "forbiddenClaims": ["yasaklı iddialar"],
    "sensitiveAreas": ["hassas konular"],
    "allowedLanguageLevel": "simple|medium|advanced"
  }
}

Sektöre göre uygun içerik üret. Yanıltıcı veya yasa dışı iddialardan kaçın. Gerektiğinde disclaimer veya uyarı ekle.`;

  return { system, user };
}

/**
 * Metin üretimi için prompt şablonu.
 * @param {Object} params
 * @param {string} params.topic - Konu
 * @param {Object} params.contentDNA - Content DNA objesi
 * @param {Object} [params.profileData] - DoctorProfile verisi (sektör, hedef kitle, ton, hedefler)
 * @returns {Object} { system, user }
 */
export function getTextGenerationPrompt({ topic, contentDNA, profileData }) {
  const system = `Sen, kullanıcının sektörüne uygun sosyal medya içerikleri üreten bir içerik AI'sısın.
Kurallar:
- Teşhis/garanti gibi kesin iddialardan kaçın (sektöre göre uygunsuz iddialar yasaktır)
- Yanıltıcı veya yanlış yönlendirici iddia yok
- Bilgilendirme veya pazarlama amaçlı içerik üret
- Kısa, net, anlaşılır ve hedef kitleye uygun ton kullan`;

  const styleGuide = contentDNA?.styleGuide || {};
  const guardrails = contentDNA?.guardrails || {};

  // Profil bilgilerini prompt'a ekle
  const profileSection = profileData ? `
Kullanıcı Profili (Profil Oluşturma'dan alınan bilgiler):
- Sektör/Branş: ${profileData.specialty || "Genel"}
- Hedef Kitle: ${profileData.targetAudience || "Genel halk"}
- Ton Tercihi: ${profileData.tone || "Sakin"}
- Hedefler: ${profileData.goals ? (typeof profileData.goals === 'string' ? profileData.goals : JSON.stringify(profileData.goals)) : "Bilgilendirme"}
- Biyografi: ${profileData.bio || "Belirtilmemiş"}

Bu profil bilgilerine göre, içeriği özelleştirilmiş ve kişiselleştirilmiş şekilde oluştur.
` : "";

  const user = `${profileSection}
Konu: ${topic || "Genel konu"}

Content DNA:
- Ton: ${contentDNA?.normalizedTone || "sakin"}
- Yazım Stili: ${styleGuide.writingStyle || "kısa ve net"}
- Yapılacaklar: ${(styleGuide.do || []).join(", ")}
- Yapılmayacaklar: ${(styleGuide.dont || []).join(", ")}
- CTA Stili: ${styleGuide.ctaStyle || "Harekete geçirici çağrı"}
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
  const system = `Sen bir içerik güvenlik kontrol AI'sın. Metinlerde riskli dil, yanıltıcı veya hukuka aykırı iddiaları tespit et ve düzeltme önerileri sun.`;

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
- Ciddi, yanıltıcı veya hukuka aykırı ifadeler varsa: warn
- Sadece bilgilendirme veya pazarlama amaçlı, yanlış yönlendirme yoksa: pass`;

  return { system, user };
}

