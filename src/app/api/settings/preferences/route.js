// Türkçe yorum: Doktor profilinde contentPreferences alanını güncelleyen endpoint.
//  - referenceMediaIds, preferredVisualTags, styleNotes kaydedilir
//  - analyzeWithAI=true ve OPENAI_API_KEY varsa, kısa bir stil özeti üretip ContentDNA.styleGuide'a işler

import { getServerSession } from "next-auth";
import prisma from "../../../../lib/prisma";
import { authOptions } from "../../../../lib/auth";
import { callOpenAIChat } from "../../../../lib/ai/openaiClient";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Yetkisiz" }), { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      referenceMediaIds = [],
      preferredVisualTags = [],
      styleNotes = "",
      analyzeWithAI = false,
    } = body || {};

    // Türkçe yorum: DoctorProfile.contentPreferences güncelle
    const profile = await prisma.doctorProfile.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        specialty: "Genel",
        targetAudience: "",
        tone: "",
        goals: {},
        contentPreferences: { referenceMediaIds, preferredVisualTags, styleNotes },
      },
      update: {
        contentPreferences: { referenceMediaIds, preferredVisualTags, styleNotes },
      },
    });

    let styleSummary = null;

    // Türkçe yorum: Opsiyonel AI analizi
    if (analyzeWithAI && process.env.OPENAI_API_KEY) {
      const tags = (preferredVisualTags || []).join(", ");
      const user = `Aşağıdaki kullanıcı tercihlerine göre kısa bir stil özeti çıkar.

Tercihler:
- Görsel etiketler: ${tags || "belirtilmedi"}
- Notlar: ${styleNotes || "yok"}

Sadece 2-3 cümlede, renk paleti, kompozisyon, his/ton odaklı özet yaz.`;
      const system = "Sen bir görsel stil analisti AI'sın; kısa ve net özetler yazarsın.";

      const ai = await callOpenAIChat({
        system,
        user,
        temperature: 0.5,
        maxTokens: 180,
        responseJson: false,
      });

      if (ai.ok && typeof ai.data === "string") {
        styleSummary = ai.data.trim();

        // Türkçe yorum: ContentDNA.styleGuide içine işle (varsa güncelle, yoksa oluştur).
        const cdna = await prisma.contentDNA.findFirst({ where: { userId: session.user.id } });
        if (cdna) {
          const nextStyle = {
            ...(cdna.styleGuide || {}),
            visualStyle: (cdna.styleGuide?.visualStyle || "stilize-profesyonel"),
            visualTags: preferredVisualTags || [],
            styleSummary,
          };
          await prisma.contentDNA.update({
            where: { id: cdna.id },
            data: { styleGuide: nextStyle },
          });
        }
      }
    }

    return Response.json({
      ok: true,
      profileId: profile.id,
      styleSummary,
    });
  } catch (error) {
    console.error("Preferences save error:", error);
    return new Response(JSON.stringify({ error: "Sunucu hatası" }), { status: 500 });
  }
}


