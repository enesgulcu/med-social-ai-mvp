// Türkçe yorum: Studio için AI önerileri endpoint'i; her input için 5 alternatif örnek üretir.

import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import prisma from "../../../../lib/prisma";
import { callOpenAIChat } from "../../../../lib/ai/openaiClient";
// Simple in-memory cache for AI suggestions to avoid repeated identical calls.
// Keyed by a stable JSON of request parameters. TTL applied on read.
const SUGGESTIONS_CACHE = new Map();
const SUGGESTIONS_CACHE_TTL = 1000 * 60 * 5; // 5 minutes

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Yetkisiz" }), { status: 401 });
  }

  let field = null;
  let excludeSuggestions = [];
  let generationIndex = 0;
  let userRequest = "";
  try {
    const body = await req.json();
    field = body?.field;
    const { currentValue = "", otherFields = {} } = body || {};
    excludeSuggestions = body?.excludeSuggestions || [];
    generationIndex = body?.generationIndex || 0;
    userRequest = body?.userRequest || "";

    if (!field) {
      return new Response(JSON.stringify({ error: "Alan adı gerekli" }), { status: 400 });
    }

    // Kullanıcının profil ve ContentDNA bilgilerini al
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        profile: true,
        contentDNA: {
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
    });

    if (!user) {
      return new Response(JSON.stringify({ error: "Kullanıcı bulunamadı" }), { status: 404 });
    }

    // Daha önce üretilen TÜM içerikleri al (aynılarını üretmemek için)
    // MongoDB bellek limiti hatası önlemek için optimize edilmiş query
    let previousAssets = [];
    try {
      // Önce orderBy ile dene (daha az kayıt)
      previousAssets = await prisma.asset.findMany({
        where: { userId: session.user.id },
        select: { 
          id: true,
          title: true, 
          body: true, 
          type: true,
          createdAt: true,
        },
        // Sort by `id` (MongoDB _id) which is indexed and avoids expensive in-memory sorts
        orderBy: { id: "desc" },
        take: 10, // Son 10 içerik (bellek limiti için azaltıldı)
      });
    } catch (error) {
      // Eğer sort hatası alırsak, orderBy olmadan dene
      if (error.code === 'P2010' || error.message?.includes('memory limit') || error.message?.includes('QueryExceededMemoryLimit')) {
        console.warn("MongoDB sort hatası, orderBy olmadan tekrar deneniyor:", error.message);
        try {
          // OrderBy olmadan, sadece limit ile çek
          previousAssets = await prisma.asset.findMany({
            where: { userId: session.user.id },
            select: { 
              title: true, 
              body: true, 
              type: true,
            },
            take: 10, // OrderBy olmadan son 10 kayıt (sıralama garantisi yok ama çalışır)
          });
        } catch (retryError) {
          console.error("Asset query hatası (retry):", retryError);
          // Hata durumunda boş array kullan - excludeSuggestions zaten frontend'den geliyor
          previousAssets = [];
        }
      } else {
        console.error("Asset query hatası:", error);
        // Diğer hatalar için de boş array kullan
        previousAssets = [];
      }
    }

    // Tüm daha önce üretilen içeriklerden ilgili field'a göre verileri çıkar
    const previousData = previousAssets
      .map((asset) => {
        if (typeof asset.body === "object") {
          // Metadata'dan ilgili field'ı al
          if (asset.body?.metadata) {
            const metadata = asset.body.metadata;
            if (field === "topic" && metadata.topic) return metadata.topic;
            if (field === "description" && metadata.description) return metadata.description;
            if (field === "purpose" && metadata.purpose) return metadata.purpose;
            if (field === "targetAudience" && metadata.targetAudience) return metadata.targetAudience;
          }
          // Eski format desteği
          if (asset.body?.text?.topic && field === "topic") return asset.body.text.topic;
        }
        // Title'dan topic çıkar (eğer topic field'ı ise)
        if (field === "topic" && asset.title) return asset.title;
        return null;
      })
      .filter(Boolean);

    // Daha önce üretilen konular (genel bilgi için)
    const previousTopics = previousAssets
      .map((asset) => {
        if (typeof asset.body === "object" && asset.body?.metadata?.topic) {
          return asset.body.metadata.topic;
        }
        if (typeof asset.body === "object" && asset.body?.text?.topic) {
          return asset.body.text.topic;
        }
        return asset.title;
      })
      .filter(Boolean);

    // Onboarding bilgileri - TÜM veriler
    const profile = user.profile;
    const contentDNA = user.contentDNA[0];
    const specialty = profile?.specialty || "";
    const targetAudience = profile?.targetAudience || "";
    const tone = profile?.tone || "";
    const goals = typeof profile?.goals === "string" ? profile.goals : profile?.goals?.text || "";
    
    // Tone details ve visual preferences
    const toneDetails = profile?.contentPreferences?.toneDetails || {};
    const visualPreferences = profile?.contentPreferences?.visualPreferences || {};
    const normalizedTone = toneDetails?.normalizedTone || contentDNA?.normalizedTone || "";
    const toneDescription = toneDetails?.description || "";
    const toneCharacteristics = Array.isArray(toneDetails?.characteristics) ? toneDetails.characteristics.join(", ") : "";
    const visualStyle = visualPreferences?.visualStyle || "";
    const visualTags = Array.isArray(visualPreferences?.tags) ? visualPreferences.tags.join(", ") : "";
    const visualSummary = visualPreferences?.summary || "";

    // Daha önce gösterilen önerileri hariç tut
    console.log("excludeSuggestions received:", excludeSuggestions.length, "items"); // Debug
    console.log("generationIndex received:", generationIndex); // Debug
    
    // Generation index: Kaç kez yeni öneri üretildi (her seferinde farklı yaklaşım için)
    // Eğer body'den gelmediyse, excludeSuggestions uzunluğundan hesapla
    if (generationIndex === 0 && excludeSuggestions.length > 0) {
      generationIndex = Math.floor(excludeSuggestions.length / 5);
    }
    
    // Her generation için farklı perspektifler
    const perspectives = [
      "Klinik ve tıbbi odaklı",
      "Hasta eğitimi ve bilgilendirme odaklı",
      "Yaşam tarzı ve önleme odaklı",
      "Güncel araştırmalar ve yenilikler odaklı",
      "Pratik uygulamalar ve ipuçları odaklı",
      "Toplumsal sağlık ve farkındalık odaklı",
      "Kişiselleştirilmiş yaklaşımlar odaklı",
      "Multidisipliner ve bütünsel sağlık odaklı",
    ];
    const currentPerspective = perspectives[generationIndex % perspectives.length];
    
    const excludeText = excludeSuggestions.length > 0 
      ? `\n\n🚫 YASAK ÖNERİLER LİSTESİ (${excludeSuggestions.length} adet - BUNLARI ASLA KULLANMA):\n${excludeSuggestions.map((s, i) => `   ${i + 1}. "${s}"`).join("\n")}\n\n⚠️ KRİTİK TALİMAT:\n- Yukarıdaki listedeki hiçbir öneriyi, hiçbir kelimesini, hiçbir ifadesini kullanma.\n- Benzer anlamda bile olsa, aynı kelimeleri kullanma.\n- Tamamen yeni, farklı ve yaratıcı öneriler üret.\n- Bu sefer ${currentPerspective} bir yaklaşım kullan.\n- Her öneri benzersiz olmalı, hiçbiri birbirine benzememeli.`
      : "";

    // Kullanıcının özel talebi
    const userRequestText = userRequest.trim()
      ? `\n\n💬 KULLANICI ÖZEL TALEBİ:\n"${userRequest.trim()}"\n\n⚠️ ÖNEMLİ: Yukarıdaki kullanıcı talebini DİKKATLE oku ve buna göre öneriler üret. Kullanıcının istediği özellikleri, yönlendirmelerini ve taleplerini mutlaka dikkate al. Önerilerin kullanıcının talebine uygun olması çok önemli.`
      : "";

    // Onboarding bilgileri detaylı özeti
    const onboardingContext = `
KULLANICI PROFİLİ:
- Branş/Uzmanlık: ${specialty || "Genel"}
- Hedef Kitle: ${targetAudience || "Genel"}
- İletişim Tonu: ${tone || "Profesyonel"}
- İçerik Hedefleri: ${goals || "Bilgilendirme"}
${normalizedTone ? `- Normalize Ton: ${normalizedTone}` : ""}
${toneDescription ? `- Ton Açıklaması: ${toneDescription}` : ""}
${toneCharacteristics ? `- Ton Özellikleri: ${toneCharacteristics}` : ""}
${visualStyle ? `- Görsel Stil Tercihi: ${visualStyle}` : ""}
${visualTags ? `- Görsel Etiketler: ${visualTags}` : ""}
${visualSummary ? `- Görsel Özet: ${visualSummary}` : ""}

DAHA ÖNCE ÜRETİLEN İÇERİKLER:
${previousData.length > 0 ? `Bu alan için daha önce üretilen ${previousData.length} örnek:\n${previousData.map((d, i) => `${i + 1}. "${d}"`).join("\n")}` : "Bu alan için henüz içerik üretilmemiş"}
${previousTopics.length > 0 && field === "topic" ? `\nGenel olarak üretilen konular: ${previousTopics.slice(0, 10).join(", ")}` : ""}
`;

    // Field'a göre prompt oluştur - excludeText'i en başa al (daha vurgulu)
    const fieldPrompts = {
      topic: `${excludeText}
${userRequestText}

${onboardingContext}

MEVCUT İÇERİK BİLGİLERİ:
${otherFields.description ? `- Açıklama: ${otherFields.description}` : ""}
${otherFields.purpose ? `- Amaç: ${otherFields.purpose}` : ""}
${otherFields.targetAudience ? `- Hedef Kitle: ${otherFields.targetAudience}` : ""}

GÖREV: 5 farklı, yaratıcı ve ilgi çekici konu önerisi üret.
YAKLAŞIM: ${currentPerspective} bir perspektif kullan.
FORMAT: Her konu başlık formatında, kısa ve net olmalı (5-10 kelime arası).
ÖRNEK FORMAT: "Hipertansiyon kontrolü ve yaşam tarzı", "Diyabet yönetimi ipuçları", "Kalp sağlığı için egzersiz"
Her öneri tek satır, numaralı liste formatında olmalı (1. Örnek, 2. Örnek şeklinde).
ÖNEMLİ: 
- Her öneri birbirinden tamamen farklı olmalı, farklı açılardan yaklaşmalı.
- Kullanıcının branşı, hedef kitlesi, ton tercihleri ve görsel stil tercihlerini dikkate al.
- Daha önce üretilen içeriklerden tamamen farklı olmalı.`,

      description: `${excludeText}
${userRequestText}

${onboardingContext}

MEVCUT İÇERİK BİLGİLERİ:
- Konu: "${otherFields.topic || currentValue}"
${otherFields.purpose ? `- Amaç: ${otherFields.purpose}` : ""}
${otherFields.targetAudience ? `- Hedef Kitle: ${otherFields.targetAudience}` : ""}

GÖREV: "${otherFields.topic || currentValue}" konusu hakkında 5 farklı, detaylı açıklama önerisi üret.
YAKLAŞIM: ${currentPerspective} bir perspektif kullan.
TON: Kullanıcının tercih ettiği ton (${tone || "Profesyonel"}) ve ton özelliklerini (${toneCharacteristics || "Empatik, Açıklayıcı"}) dikkate al.
FORMAT: Her açıklama 2-4 cümle uzunluğunda, konuyu detaylıca açıklayan bir paragraf olmalı.
ÖRNEK FORMAT: "Bu konu hakkında temel bilgiler ve pratik öneriler sunuyoruz. Hastaların günlük yaşamlarında uygulayabilecekleri basit yöntemler ve dikkat edilmesi gereken önemli noktalar ele alınmaktadır."
Her öneri tek satır, numaralı liste formatında olmalı (1. Örnek, 2. Örnek şeklinde). Açıklama formatında olmalı, başlık değil.
ÖNEMLİ: 
- Her açıklama farklı bir açıdan yaklaşmalı, farklı vurgular yapmalı.
- Kullanıcının branşı, hedef kitlesi ve ton tercihlerine uygun yaz.
- Daha önce üretilen içeriklerden tamamen farklı olmalı.`,

      purpose: `${excludeText}
${userRequestText}

${onboardingContext}

MEVCUT İÇERİK BİLGİLERİ:
- Konu: "${otherFields.topic || ""}"
${otherFields.description ? `- Açıklama: ${otherFields.description}` : ""}
${otherFields.targetAudience ? `- Hedef Kitle: ${otherFields.targetAudience}` : ""}

GÖREV: Bu içerik için 5 farklı amaç önerisi üret.
YAKLAŞIM: ${currentPerspective} bir perspektif kullan.
KULLANICI HEDEFLERİ: ${goals || "Bilgilendirme"} - Bu hedeflere uygun amaçlar öner.
FORMAT: Her öneri 1-3 kelimelik bir amaç ifadesi olmalı.
ÖRNEK FORMAT: "Bilgilendirme", "Hasta eğitimi", "Farkındalık yaratma", "Randevu yönlendirme", "Güven oluşturma"
Her öneri tek satır, numaralı liste formatında olmalı (1. Örnek, 2. Örnek şeklinde).
ÖNEMLİ: 
- Her öneri farklı bir amacı temsil etmeli.
- Kullanıcının genel hedeflerine (${goals || "Bilgilendirme"}) uygun olmalı.
- Daha önce üretilen içeriklerden tamamen farklı olmalı.`,

      targetAudience: `${excludeText}
${userRequestText}

${onboardingContext}

MEVCUT İÇERİK BİLGİLERİ:
- Konu: "${otherFields.topic || ""}"
${otherFields.description ? `- Açıklama: ${otherFields.description}` : ""}
${otherFields.purpose ? `- Amaç: ${otherFields.purpose}` : ""}

GÖREV: Bu içerik için 5 farklı, spesifik hedef kitle önerisi üret.
YAKLAŞIM: ${currentPerspective} bir perspektif kullan.
GENEL HEDEF KİTLE: ${targetAudience || "Genel"} - Bu genel kitleye uygun, daha spesifik alt gruplar öner.
FORMAT: Her öneri yaş aralığı, hastalık durumu veya demografik özellik içeren bir hedef kitle tanımı olmalı (5-15 kelime).
ÖRNEK FORMAT: "30-50 yaş hipertansiyon hastaları", "Genç yetişkinler (18-30 yaş)", "Çocuklu aileler", "Kronik hastalık riski olanlar"
Her öneri tek satır, numaralı liste formatında olmalı (1. Örnek, 2. Örnek şeklinde).
ÖNEMLİ: 
- Her öneri farklı bir demografik grubu hedeflemeli.
- Kullanıcının branşı (${specialty || "Genel"}) ve genel hedef kitlesine (${targetAudience || "Genel"}) uygun olmalı.
- Daha önce üretilen içeriklerden tamamen farklı olmalı.`,
    };

    // Server-side cache check: compute a stable key for this suggestions request
    try {
      const cacheKeyObj = {
        userId: session.user.id,
        field,
        currentValue,
        otherFields,
        generationIndex,
        userRequest,
        // include visual preferences influence to avoid false cache hits
        visualTags,
        visualStyle,
      };
      const cacheKey = JSON.stringify(cacheKeyObj);
      const cached = SUGGESTIONS_CACHE.get(cacheKey);
      if (cached && Date.now() - cached.ts < SUGGESTIONS_CACHE_TTL) {
        return new Response(JSON.stringify({ suggestions: cached.suggestions, cached: true }), { status: 200 });
      }
    } catch (e) {
      // ignore cache errors
    }

    const userPrompt = fieldPrompts[field] || `5 farklı örnek üret: ${field}`;

    const system = excludeSuggestions.length > 0
      ? `Sen bir içerik stratejisti AI'sın. Doktorların sosyal medya içerikleri için öneriler sunuyorsun.
Kullanıcının onboarding bilgilerini dikkate alarak, özgün ve yaratıcı öneriler üretmelisin.

⚠️ KRİTİK KURAL: Kullanıcı daha önce ${excludeSuggestions.length} öneri gördü ve beğenmedi. Bu önerilerden KESINLIKLE farklı, tamamen yeni öneriler üretmelisin. 

YENİ YAKLAŞIM: Bu sefer ${currentPerspective} bir perspektif kullan. Önceki önerilerden tamamen farklı bir açıdan yaklaş. Aynı kelimeleri, benzer ifadeleri kullanma. Her öneri benzersiz ve yaratıcı olmalı. Her öneri birbirinden de farklı olmalı, farklı açılardan yaklaşmalı.

Her öneri field'ın amacına uygun format ve uzunlukta olmalıdır.`
      : `Sen bir içerik stratejisti AI'sın. Doktorların sosyal medya içerikleri için öneriler sunuyorsun.
Kullanıcının onboarding bilgilerini dikkate alarak, özgün ve yaratıcı öneriler üretmelisin.
Daha önce üretilen içeriklerden farklı olmalısın.
Her öneri field'ın amacına uygun format ve uzunlukta olmalıdır.`;

    // Ucuz model kullan (gpt-4o-mini - düşük maliyet)
    // callOpenAIChat zaten env'den model alıyor, gpt-4o-mini varsayılan olarak ucuz model
    // excludeSuggestions varsa temperature'ı artır ve her generation'da biraz değiştir (daha farklı öneriler için)
    const baseTemperature = excludeSuggestions.length > 0 ? 0.95 : 0.85;
    // Her generation'da temperature'ı biraz değiştir (0.9-1.0 arası)
    const temperature = excludeSuggestions.length > 0 
      ? Math.min(1.0, baseTemperature + (generationIndex * 0.02))
      : baseTemperature;
    
    console.log("Calling AI with:", {
      field,
      excludeCount: excludeSuggestions.length,
      generationIndex,
      perspective: currentPerspective,
      temperature: temperature.toFixed(2),
      hasExcludeText: excludeText.length > 0
    }); // Debug
    
    const result = await callOpenAIChat({
      system,
      user: userPrompt,
      temperature, // excludeSuggestions varsa maksimum (daha farklı öneriler)
      maxTokens: field === "description" ? 500 : 300, // Description için daha fazla token
      responseJson: false,
    });
    
    console.log("AI response received, ok:", result.ok); // Debug

    if (!result.ok || !result.data) {
      console.error("AI öneri başarısız:", result);
      // Statik fallback kaldırıldı - sadece AI'dan gelen öneriler gösterilecek
      // Eğer AI başarısız olursa, kullanıcıya hata mesajı döndür
      return new Response(
        JSON.stringify({
          error: "AI önerileri alınamadı",
          message: result.message || "Yapay zeka servisi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.",
          errorCode: result.errorCode || "AI_ERROR",
        }),
        { status: 500 }
      );
    }

    // AI'dan gelen metni parse et (5 örnek çıkar)
    const text = result.data;
    console.log("AI'dan gelen metin:", text); // Debug
    
    if (!text || typeof text !== "string") {
      console.error("AI'dan geçersiz metin geldi:", text);
      // Statik fallback kaldırıldı - sadece AI'dan gelen öneriler gösterilecek
      return new Response(
        JSON.stringify({
          error: "AI önerileri alınamadı",
          message: "Yapay zeka servisinden geçersiz yanıt alındı. Lütfen daha sonra tekrar deneyin.",
          errorCode: "INVALID_RESPONSE",
        }),
        { status: 500 }
      );
    }

    const suggestions = [];
    
    // Normalize function for case-insensitive comparison
    const normalize = (str) => str.trim().toLowerCase();
    const excludeNormalized = excludeSuggestions.map(normalize);

    // Farklı formatları dene
    const lines = text.split("\n").filter((line) => line.trim().length > 0);
    
    for (const line of lines) {
      // Numaralı liste formatı: "1. Örnek" veya "1- Örnek" veya "1) Örnek"
      const match = line.match(/^\d+[\.\-\)]\s*(.+)$/);
      if (match) {
        const suggestion = match[1].trim();
        const normalized = normalize(suggestion);
        if (suggestion.length > 3 && !suggestions.includes(suggestion) && !excludeNormalized.includes(normalized)) {
          suggestions.push(suggestion);
        }
      } else if (line.trim().match(/^[\-\•\*]\s+/)) {
        // Madde işareti formatı
        const suggestion = line.replace(/^[\-\•\*]\s+/, "").trim();
        const normalized = normalize(suggestion);
        if (suggestion.length > 3 && !suggestions.includes(suggestion) && !excludeNormalized.includes(normalized)) {
          suggestions.push(suggestion);
        }
      } else if (line.trim().length > 5 && !line.includes(":") && !line.toLowerCase().includes("öneri") && !line.toLowerCase().includes("suggestion")) {
        // Düz metin (başlık değilse)
        const suggestion = line.trim();
        const normalized = normalize(suggestion);
        if (!suggestions.includes(suggestion) && !excludeNormalized.includes(normalized)) {
          suggestions.push(suggestion);
        }
      }
    }

    // Eğer 5'ten az öneri varsa, metni parçalara böl
    if (suggestions.length < 5) {
      // Virgülle ayrılmış liste varsa
      const commaSeparated = text.split(",").map(s => s.trim()).filter(s => s.length > 5);
      for (const item of commaSeparated) {
        if (suggestions.length >= 5) break;
        const normalized = normalize(item);
        if (!suggestions.includes(item) && !excludeNormalized.includes(normalized)) {
          suggestions.push(item);
        }
      }
      
      // Hala yeterli değilse cümleleri dene
      if (suggestions.length < 5) {
        const sentences = text.split(/[\.\n]/).filter((s) => s.trim().length > 10);
        for (const sentence of sentences) {
          if (suggestions.length >= 5) break;
          const cleaned = sentence.trim();
          const normalized = normalize(cleaned);
          if (cleaned && !suggestions.includes(cleaned) && !excludeNormalized.includes(normalized) && !cleaned.toLowerCase().includes("öneri")) {
            suggestions.push(cleaned);
          }
        }
      }
    }

    // Daha önce gösterilen önerileri filtrele (normalize ve excludeNormalized zaten yukarıda tanımlı)
    const filteredSuggestions = suggestions.filter(s => {
      const normalized = normalize(s);
      const isExcluded = excludeNormalized.includes(normalized);
      if (isExcluded) {
        console.log("Filtered out duplicate:", s); // Debug
      }
      return !isExcluded;
    });
    
    console.log("After filtering:", filteredSuggestions.length, "unique suggestions out of", suggestions.length); // Debug
    
    // Tam olarak 5 örnek döndür
    let finalSuggestions = filteredSuggestions.slice(0, 5);
    
    // Eğer hala 5'ten azsa, AI'dan daha fazla öneri iste (retry)
    if (finalSuggestions.length < 5) {
      console.warn(`Sadece ${finalSuggestions.length} öneri parse edildi, AI'dan daha fazla öneri isteniyor...`);
      
      // AI'ya daha fazla öneri iste
      const retryResult = await callOpenAIChat({
        system: system + "\n\nÖNEMLİ: Daha fazla öneri üret, en az 10 farklı öneri sun.",
        user: userPrompt + "\n\nLütfen daha fazla öneri üret, en az 10 farklı örnek sun.",
        temperature: Math.min(1.0, temperature + 0.1),
        maxTokens: field === "description" ? 800 : 500,
        responseJson: false,
      });
      
      if (retryResult.ok && retryResult.data) {
        const retryText = retryResult.data;
        const retryLines = retryText.split("\n").filter((line) => line.trim().length > 0);
        
        for (const line of retryLines) {
          if (finalSuggestions.length >= 5) break;
          
          const match = line.match(/^\d+[\.\-\)]\s*(.+)$/);
          if (match) {
            const suggestion = match[1].trim();
            const normalized = normalize(suggestion);
            if (suggestion.length > 3 && !excludeNormalized.includes(normalized) && !finalSuggestions.some(fs => normalize(fs) === normalized)) {
              finalSuggestions.push(suggestion);
            }
          } else if (line.trim().match(/^[\-\•\*]\s+/)) {
            const suggestion = line.replace(/^[\-\•\*]\s+/, "").trim();
            const normalized = normalize(suggestion);
            if (suggestion.length > 3 && !excludeNormalized.includes(normalized) && !finalSuggestions.some(fs => normalize(fs) === normalized)) {
              finalSuggestions.push(suggestion);
            }
          }
        }
      }
      
      // Eğer hala yeterli değilse, kullanıcıya bilgi ver
      if (finalSuggestions.length < 5) {
        console.warn(`Sadece ${finalSuggestions.length} benzersiz öneri bulundu. Kullanıcıya gönderiliyor.`);
      }
    }

    console.log("Parse edilmiş öneriler:", finalSuggestions); // Debug

    // Store in cache for identical future requests
    try {
      const cacheKeyObj = {
        userId: session.user.id,
        field,
        currentValue,
        otherFields,
        generationIndex,
        userRequest,
        visualTags,
        visualStyle,
      };
      const cacheKey = JSON.stringify(cacheKeyObj);
      SUGGESTIONS_CACHE.set(cacheKey, { ts: Date.now(), suggestions: finalSuggestions });
      // basic cleanup of old entries (rarely run)
      if (SUGGESTIONS_CACHE.size > 5000) {
        const now = Date.now();
        for (const [k, v] of SUGGESTIONS_CACHE.entries()) {
          if (now - v.ts > SUGGESTIONS_CACHE_TTL) SUGGESTIONS_CACHE.delete(k);
        }
      }
    } catch (e) {
      // ignore cache set errors
    }

    return Response.json({ suggestions: finalSuggestions });
  } catch (error) {
    console.error("AI öneri hatası:", error);
    // Statik fallback kaldırıldı - sadece AI'dan gelen öneriler gösterilecek
    // Hata durumunda kullanıcıya bilgi ver
    return new Response(
      JSON.stringify({
        error: "AI önerileri alınamadı",
        message: error.message || "Yapay zeka servisi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.",
        errorCode: "AI_ERROR",
      }),
      { status: 500 }
    );
  }
}
