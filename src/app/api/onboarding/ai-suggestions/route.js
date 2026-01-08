// Türkçe yorum: AI destekli onboarding önerileri için endpoint'ler.
// Branş önerileri, hedef kitle soruları ve ton belirleme için kullanılır.

import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { callOpenAIChat } from "../../../../lib/ai/openaiClient";

/**
 * Branş önerileri endpoint'i
 * En popüler 10 branşı AI ile önerir
 */
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: "Yetkisiz" }), { status: 401 });
  }

  try {
    const system = `Sen bir sektör uzmanı AI'sın. Türkiye'de öne çıkan sektörleri listeliyorsun. Yanıtları Türkçe ve JSON formatında ver.`;

    const user = `Türkiye'de öne çıkan 10 sektör veya iş alanını listele.
Her sektör kısa ve net olmalı (örn: E-ticaret, Eğitim, Sağlık).
Sadece JSON formatında döndür:
{
  "suggestions": ["Sektör1", "Sektör2", ...]
}`;

    const result = await callOpenAIChat({
      system,
      user,
      temperature: 0.3,
      maxTokens: 300,
      responseJson: true,
    });

    if (result.ok && result.data?.suggestions) {
      return Response.json({ suggestions: result.data.suggestions });
    }

    // Fallback: En popüler branşlar
    const fallbackSuggestions = [
      "Sağlık",
      "E-ticaret",
      "Finans",
      "Eğitim",
      "Teknoloji / SaaS",
      "Restoran / Yiyecek",
      "Konaklama / Turizm",
      "Hukuk",
      "Güzellik & Kişisel Bakım",
      "Emlak",
    ];

    return Response.json({ suggestions: fallbackSuggestions, usedMock: !result.ok });
  } catch (error) {
    console.error("Branş önerileri hatası:", error);
    return new Response(JSON.stringify({ error: "Sunucu hatası" }), { status: 500 });
  }
}
