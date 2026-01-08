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

    // Try to fetch DynamicProfile for this user (most recent)
    const dynamic = await prisma.dynamicProfile.findFirst({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } });

    if (!profile && !dynamic) {
      return Response.json({ data: null, hasProfile: false });
    }

    // If DynamicProfile exists prefer it as onboarding source
    if (dynamic && dynamic.preferences) {
      const prefs = dynamic.preferences || {};
      const onboardingData = {
        sector: dynamic.sector || prefs.sector || "",
        sectorArea: prefs.sectorArea || "",
        specialty: prefs.specialty || profile?.specialty || "",
        targetAudience: prefs.targetAudience || profile?.targetAudience || "",
        audienceAnswers: prefs.audienceAnswers || {},
        audienceQuestions: prefs.audienceQuestions || null,
        audienceSuggestions: prefs.audienceSuggestions || null,
        productionGuidelines: prefs.productionGuidelines || "",
        tone: prefs.normalizedTone || profile?.tone || "",
        goals: prefs.goals || (typeof profile?.goals === "string" ? profile.goals : (profile?.goals?.text || "")),
        toneDetails: prefs.toneDetails || {},
        toneQuestions: prefs.toneQuestions || null,
        visualPreferences: prefs.visualPreferences || { imageUrls: [], visualStyle: "", tags: [], summary: "" },
      };

      return Response.json({ data: onboardingData, hasProfile: true, dynamicProfile: { id: dynamic.id, sector: dynamic.sector, name: dynamic.name } });
    }

    // Fallback to DoctorProfile + ContentDNA mapping
    if (!profile) {
      return Response.json({ data: null, hasProfile: false });
    }

    const onboardingData = {
      sector: profile.contentPreferences?.sector || "",
      sectorArea: profile.contentPreferences?.sectorArea || "",
      specialty: profile.specialty || "",
      productionGuidelines: profile.contentPreferences?.productionGuidelines || "",
      targetAudience: profile.targetAudience || "",
      audienceAnswers: profile.contentPreferences?.audienceAnswers || {},
      audienceQuestions: profile.contentPreferences?.audienceQuestions || null,
      audienceSuggestions: profile.contentPreferences?.audienceSuggestions || null,
      tone: profile.tone || "",
      goals: typeof profile.goals === "string" ? profile.goals : (profile.goals?.text || ""),
      toneDetails: profile.contentPreferences?.toneDetails || {},
      toneQuestions: profile.contentPreferences?.toneQuestions || null,
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

    return Response.json({ data: onboardingData, hasProfile: true });
  } catch (error) {
    console.error("Onboarding veri yükleme hatası:", error);
    return new Response(JSON.stringify({ error: "Sunucu hatası" }), { status: 500 });
  }
}
