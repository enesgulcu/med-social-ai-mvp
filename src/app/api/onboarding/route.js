import { getServerSession } from "next-auth";
import prisma from "../../../lib/prisma";
import { onboardingSchema } from "../../../features/onboarding/schema";
import { createOrUpdateContentDNAFromOnboarding } from "../../../features/contentDNA";
import { authOptions } from "../../../lib/auth";

// Türkçe yorum: Onboarding verisini kaydeder ve Content DNA v2 (AI destekli) üretir.
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: "Yetkisiz" }), { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = onboardingSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Geçersiz veri" }), { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return new Response(JSON.stringify({ error: "Kullanıcı bulunamadı" }), { status: 404 });

    // Profil kaydı (upsert) - AI destekli alanları da kaydet
    const profileData = {
      specialty: parsed.data.specialty,
      targetAudience: parsed.data.targetAudience,
      tone: parsed.data.tone,
      goals: parsed.data.goals,
      contentPreferences: {
        toneDetails: parsed.data.toneDetails || {},
        visualPreferences: parsed.data.visualPreferences || {},
      },
    };

    await prisma.doctorProfile.upsert({
      where: { userId: user.id },
      create: { ...profileData, userId: user.id },
      update: profileData,
    });

    // Türkçe yorum: Content DNA v2 üretimi (AI destekli + fallback).
    // Visual preferences'i de styleGuide'a ekle
    const cdna = await createOrUpdateContentDNAFromOnboarding(parsed.data);
    
    // Visual preferences'i styleGuide'a ekle
    if (parsed.data.visualPreferences) {
      cdna.styleGuide = {
        ...cdna.styleGuide,
        visualStyle: parsed.data.visualPreferences.visualStyle || cdna.styleGuide?.visualStyle,
        visualTags: parsed.data.visualPreferences.tags || [],
        visualSummary: parsed.data.visualPreferences.summary || "",
      };
    }

    const existing = await prisma.contentDNA.findFirst({ where: { userId: user.id } });
    if (existing) {
      await prisma.contentDNA.update({ where: { id: existing.id }, data: cdna });
    } else {
      await prisma.contentDNA.create({ data: { userId: user.id, ...cdna } });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    console.error("Onboarding error", error);
    return new Response(JSON.stringify({ error: "Sunucu hatası" }), { status: 500 });
  }
}


