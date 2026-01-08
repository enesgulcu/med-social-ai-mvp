// Türkçe yorum: Onboarding için mevcut profil verilerini yükler.

import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import prisma from "../../../../lib/prisma";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: "Yetkisiz" }), { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({ 
      where: { email: session.user.email },
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

    const profile = user.profile;
    const contentDNA = user.contentDNA[0] || null;

    if (!profile) {
      return Response.json({
        data: null,
        hasProfile: false,
      });
    }

    // Profil verilerini onboarding formatına çevir
    const onboardingData = {
      specialty: profile.specialty || "",
      targetAudience: profile.targetAudience || "",
      tone: profile.tone || "",
      goals: typeof profile.goals === "string" ? profile.goals : (profile.goals?.text || ""),
      toneDetails: profile.contentPreferences?.toneDetails || {},
      visualPreferences: profile.contentPreferences?.visualPreferences || {
        imageUrls: [],
        visualStyle: "",
        tags: [],
        summary: "",
      },
    };

    // ContentDNA'dan toneDetails'i al (eğer varsa)
    if (contentDNA && contentDNA.styleGuide) {
      onboardingData.toneDetails = {
        normalizedTone: contentDNA.normalizedTone || onboardingData.toneDetails.normalizedTone,
        description: onboardingData.toneDetails.description,
        characteristics: onboardingData.toneDetails.characteristics || [],
        styleGuide: contentDNA.styleGuide,
      };
    }

    return Response.json({
      data: onboardingData,
      hasProfile: true,
    });
  } catch (error) {
    console.error("Onboarding veri yükleme hatası:", error);
    return new Response(JSON.stringify({ error: "Sunucu hatası" }), { status: 500 });
  }
}
