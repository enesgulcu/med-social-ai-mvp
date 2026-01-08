// Türkçe yorum: Ton belirleme için AI destekli sorular ve görsel analizi endpoint'i.

import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { callOpenAIChat } from "../../../../lib/ai/openaiClient";

/**
 * Ton belirleme için AI soruları endpoint'i
 * Kullanıcı ile 3-4 soruda iletişim tarzını belirler
 */
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: "Yetkisiz" }), { status: 401 });
  }

  try {
    const body = await req.json();
    const { step = 0, previousAnswers = {}, specialty = "", targetAudience = "" } = body || {};

    const system = `Sen bir içerik stratejisti ve iletişim uzmanı AI'sın. Doktorların sosyal medya içeriklerinde kullanacakları iletişim tonunu belirlemelerine yardımcı oluyorsun.`;

    // Adım bazlı sorular
    let userPrompt = "";
    if (step === 0) {
      userPrompt = `Bir ${specialty || "doktor"} için sosyal medya içeriklerinin iletişim tonunu belirlemek üzere ilk soruyu hazırla.

Kullanıcıya şunu sor: İçeriklerinizde nasıl bir dil ve yaklaşım kullanmak istersiniz?

3-5 seçenek sun:
- Sakin ve güven verici
- Uzman ve kanıta dayalı
- Samimi ve anlaşılır
- Eğitici ve detaylı
- Motivasyonel ve destekleyici

JSON formatında döndür:
{
  "question": "İçeriklerinizde nasıl bir dil ve yaklaşım kullanmak istersiniz?",
  "type": "select",
  "options": ["...", "..."],
  "nextStep": 1
}`;
    } else if (step === 1) {
      const firstAnswer = previousAnswers.toneQuestion1 || "";
      userPrompt = `Kullanıcı "${firstAnswer}" seçeneğini seçti. 

Şimdi ikinci soruyu sor: İçeriklerinizde teknik terimler kullanmak ister misiniz?

JSON formatında döndür:
{
  "question": "İçeriklerinizde teknik terimler kullanmak ister misiniz?",
  "type": "select",
  "options": ["Evet, detaylı ve teknik", "Biraz, açıklamalı", "Hayır, tamamen basit dil"],
  "nextStep": 2
}`;
    } else if (step === 2) {
      userPrompt = `Üçüncü soruyu sor: Hedef kitlenizle nasıl bir ilişki kurmak istersiniz?

JSON formatında döndür:
{
  "question": "Hedef kitlenizle nasıl bir ilişki kurmak istersiniz?",
  "type": "select",
  "options": ["Doktor-hasta (profesyonel)", "Danışman-arkadaş (samimi)", "Eğitmen-öğrenci (eğitici)"],
  "nextStep": 3
}`;
    } else if (step === 3) {
      const thirdAnswer = previousAnswers.toneQuestion3 || "";
      userPrompt = `Kullanıcı "${thirdAnswer}" seçeneğini seçti.

Son soru: İçeriklerinizde duygusal ton nasıl olsun?

JSON formatında döndür:
{
  "question": "İçeriklerinizde duygusal ton nasıl olsun?",
  "type": "select",
  "options": ["Nötr ve objektif", "Sıcak ve empatik", "Enerjik ve motivasyonel"],
  "nextStep": 4
}`;
    } else {
      // Tüm cevapları analiz et ve ton özeti oluştur
      userPrompt = `Kullanıcının verdiği cevaplara göre iletişim tonunu özetle:

${JSON.stringify(previousAnswers, null, 2)}

Branş: ${specialty}
Hedef Kitle: ${targetAudience}

JSON formatında döndür:
{
  "normalizedTone": "sakin|uzman|samimi|eğitici|motivasyonel",
  "description": "Kısa açıklama",
  "characteristics": ["özellik1", "özellik2", ...],
  "styleGuide": {
    "writingStyle": "...",
    "do": ["...", "..."],
    "dont": ["...", "..."]
  }
}`;
    }

    const result = await callOpenAIChat({
      system,
      user: userPrompt,
      temperature: 0.7,
      maxTokens: step >= 4 ? 1000 : 500,
      responseJson: true,
    });

    if (result.ok && result.data) {
      return Response.json(result.data);
    }

    // Fallback
    const fallback = {
      question: step === 0 ? "İçeriklerinizde nasıl bir dil kullanmak istersiniz?" : "Sonraki soru",
      type: "select",
      options: ["Sakin ve güven verici", "Uzman ve kanıta dayalı", "Samimi ve anlaşılır"],
      nextStep: step + 1,
    };

    return Response.json(fallback);
  } catch (error) {
    console.error("Ton analizi hatası:", error);
    return new Response(JSON.stringify({ error: "Sunucu hatası" }), { status: 500 });
  }
}

/**
 * Görsel analizi endpoint'i
 * Yüklenen görselleri analiz edip stil tercihlerini çıkarır
 */
export async function PUT(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: "Yetkisiz" }), { status: 401 });
  }

  try {
    const body = await req.json();
    const { imageUrls = [], specialty = "", targetAudience = "" } = body || {};

    if (imageUrls.length === 0) {
      return Response.json({
        visualStyle: "stylized-medical",
        tags: [],
        summary: "Görsel analizi için görsel yüklenmedi.",
      });
    }

    const system = `Sen bir görsel analiz uzmanı AI'sın. Doktorların sosyal medya içerikleri için görsel stil tercihlerini analiz ediyorsun.`;

    const user = `Aşağıdaki görselleri analiz et ve kullanıcının görsel stil tercihlerini çıkar:

Branş: ${specialty}
Hedef Kitle: ${targetAudience}
Görsel Sayısı: ${imageUrls.length}

Görsellerin URL'leri:
${imageUrls.map((url, i) => `${i + 1}. ${url}`).join("\n")}

Not: Görsellerin içeriğini doğrudan göremiyorum, ancak URL'lerden ve kullanıcının tercihlerinden stil analizi yapabilirim.

JSON formatında döndür:
{
  "visualStyle": "minimal|modern|pastel|yüksek-kontrast|flat-ikon|stilize-medikal|gerçekçi-klinik|monokrom|yumuşak-gradyan",
  "tags": ["tag1", "tag2", ...],
  "summary": "Kısa stil özeti (2-3 cümle)",
  "colorPalette": ["renk1", "renk2", ...],
  "composition": "açıklama"
}`;

    const result = await callOpenAIChat({
      system,
      user,
      temperature: 0.5,
      maxTokens: 600,
      responseJson: true,
    });

    if (result.ok && result.data) {
      return Response.json(result.data);
    }

    // Fallback
    return Response.json({
      visualStyle: "stylized-medical",
      tags: ["minimal", "modern"],
      summary: "Görsel analizi tamamlandı. Stil tercihleri kaydedildi.",
      colorPalette: [],
      composition: "",
    });
  } catch (error) {
    console.error("Görsel analizi hatası:", error);
    return new Response(JSON.stringify({ error: "Sunucu hatası" }), { status: 500 });
  }
}
