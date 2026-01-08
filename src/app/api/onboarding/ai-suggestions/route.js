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
    const system = `Sen bir tıp branş uzmanı AI'sın. Türkiye'deki en popüler ve bilinen tıp branşlarını listeliyorsun.`;

    const user = `Türkiye'deki en popüler ve bilinen 10 tıp branşını listele. 
Her branş kısa ve net olmalı (örn: Kardiyoloji, Nöroloji, Ortopedi).
Sadece JSON formatında döndür:
{
  "suggestions": ["Branş1", "Branş2", ...]
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
      "Kardiyoloji",
      "Nöroloji",
      "Ortopedi",
      "Dahiliye",
      "Genel Cerrahi",
      "Kadın Hastalıkları ve Doğum",
      "Çocuk Sağlığı",
      "Göz Hastalıkları",
      "Kulak Burun Boğaz",
      "Dermatoloji",
    ];

    return Response.json({ suggestions: fallbackSuggestions, usedMock: !result.ok });
  } catch (error) {
    console.error("Branş önerileri hatası:", error);
    return new Response(JSON.stringify({ error: "Sunucu hatası" }), { status: 500 });
  }
}
