// Türkçe yorum: Hedef kitle için AI destekli sorular ve öneriler endpoint'i.

import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { callOpenAIChat } from "../../../../lib/ai/openaiClient";

/**
 * Hedef kitle soruları ve önerileri endpoint'i
 * Branşa göre özelleştirilmiş sorular ve öneriler sunar
 */
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: "Yetkisiz" }), { status: 401 });
  }

  try {
    const body = await req.json();
    const { specialty = "" } = body || {};

    const system = `Sen bir pazarlama ve hasta iletişimi uzmanı AI'sın. Doktorların sosyal medya içerikleri için hedef kitle belirlemesine yardımcı oluyorsun.`;

    const user = `Bir ${specialty || "doktor"} için sosyal medya içeriklerinin hedef kitlesini belirlemek üzere sorular hazırla.

Hedef kitle belirleme için şu konularda sorular oluştur:
1. Yaş aralığı
2. Hastalık/durum odaklı hedefleme
3. Reklam/erişim alanı (lokal, ulusal, vb.)
4. İlgi alanları

Her soru için 3-5 örnek seçenek de sun.

JSON formatında döndür:
{
  "questions": [
    {
      "id": "age",
      "question": "Hedef kitlenizin yaş aralığı nedir?",
      "type": "select",
      "options": ["18-30", "30-50", "50-65", "65+", "Tüm yaşlar"]
    },
    ...
  ],
  "suggestions": [
    "30-50 yaş hipertansiyon hastaları",
    "Genç yetişkinler için sağlık bilgilendirmesi",
    ...
  ]
}`;

    const result = await callOpenAIChat({
      system,
      user,
      temperature: 0.7,
      maxTokens: 800,
      responseJson: true,
    });

    if (result.ok && result.data) {
      return Response.json({
        questions: result.data.questions || [],
        suggestions: result.data.suggestions || [],
      });
    }

    // Fallback
    const fallback = {
      questions: [
        {
          id: "age",
          question: "Hedef kitlenizin yaş aralığı nedir?",
          type: "select",
          options: ["18-30", "30-50", "50-65", "65+", "Tüm yaşlar"],
        },
        {
          id: "condition",
          question: "Odaklanmak istediğiniz hastalık veya durum nedir?",
          type: "text",
          placeholder: "Örn: Hipertansiyon, Diyabet, Kronik ağrı",
        },
        {
          id: "area",
          question: "Hedef kitlenizin coğrafi alanı nedir?",
          type: "select",
          options: ["Lokal (şehir/bölge)", "Bölgesel", "Ulusal", "Uluslararası"],
        },
      ],
      suggestions: [
        `${specialty || "Genel"} hastaları için bilgilendirme`,
        "Sağlık bilinci yüksek bireyler",
        "Kronik hastalık yönetimi arayanlar",
      ],
    };

    return Response.json(fallback);
  } catch (error) {
    console.error("Hedef kitle soruları hatası:", error);
    return new Response(JSON.stringify({ error: "Sunucu hatası" }), { status: 500 });
  }
}
