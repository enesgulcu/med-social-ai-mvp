import { getServerSession } from "next-auth";
import prisma from "../../../lib/prisma";
import { onboardingSchema } from "../../../features/onboarding/schema";
import { createOrUpdateContentDNAFromOnboarding } from "../../../features/contentDNA";
import { upsertDynamicProfile } from "../../../lib/dynamicProfiles";
import { authOptions } from "../../../lib/auth";

// Türkçe yorum: Onboarding verisini kaydeder ve Content DNA v2 (AI destekli) üretir.
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: "Yetkisiz" }), { status: 401 });
  }

  try {
    const body = await req.json();
    
    // Eğer draft kayıt ise (son adım değilse), schema validation'ı atla
    const isDraft = body._isDraft === true;
    let parsed;
    
    if (isDraft) {
      // Draft kayıt için minimal validation
      parsed = { success: true, data: body };
    } else {
      // Final kayıt için full validation
      parsed = onboardingSchema.safeParse(body);
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: "Geçersiz veri" }), { status: 400 });
      }
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
        sector: parsed.data.sector || "",
        sectorArea: parsed.data.sectorArea || "",
        audienceAnswers: parsed.data.audienceAnswers || {},
        audienceQuestions: parsed.data.audienceQuestions || null,
        audienceSuggestions: parsed.data.audienceSuggestions || null,
        toneDetails: parsed.data.toneDetails || {},
        toneQuestions: parsed.data.toneQuestions || null,
        visualPreferences: parsed.data.visualPreferences || {},
        productionGuidelines: parsed.data.productionGuidelines || "",
      },
    };

    await prisma.doctorProfile.upsert({
      where: { userId: user.id },
      create: { ...profileData, userId: user.id },
      update: profileData,
    });

    // Draft kayıt ise sadece profil verilerini kaydet, Content DNA oluşturma
    if (isDraft) {
      // DoctorProfile'ı güncelle
      const profileData = {
        specialty: parsed.data.specialty || "",
        targetAudience: parsed.data.targetAudience || "",
        tone: parsed.data.tone || "",
        goals: parsed.data.goals || "",
        contentPreferences: {
          sector: parsed.data.sector || "",
          sectorArea: parsed.data.sectorArea || "",
          audienceAnswers: parsed.data.audienceAnswers || {},
          audienceQuestions: parsed.data.audienceQuestions !== undefined ? parsed.data.audienceQuestions : null,
          audienceSuggestions: parsed.data.audienceSuggestions !== undefined ? parsed.data.audienceSuggestions : null,
          toneDetails: parsed.data.toneDetails || {},
          toneQuestions: parsed.data.toneQuestions !== undefined ? parsed.data.toneQuestions : null,
          visualPreferences: parsed.data.visualPreferences || {},
          productionGuidelines: parsed.data.productionGuidelines || "",
        },
      };

      await prisma.doctorProfile.upsert({
        where: { userId: user.id },
        create: { ...profileData, userId: user.id },
        update: profileData,
      });

      // DynamicProfile'ı güncelle (mevcut preferences'ı koru)
      try {
        const sector = parsed.data.sector || parsed.data.specialty || "general";
        const profileName = parsed.data.profileName || `${sector} profile`;
        
        // Mevcut DynamicProfile'ı al
        const existingDynamic = await prisma.dynamicProfile.findFirst({ where: { userId: user.id, sector } });
        const existingPreferences = existingDynamic?.preferences || {};
        
        const preferences = {
          ...existingPreferences, // Mevcut preferences'ı koru
          sector: parsed.data.sector || existingPreferences.sector || "",
          sectorArea: parsed.data.sectorArea || existingPreferences.sectorArea || "",
          specialty: parsed.data.specialty || existingPreferences.specialty || "",
          targetAudience: parsed.data.targetAudience || existingPreferences.targetAudience || "",
          audienceAnswers: parsed.data.audienceAnswers || existingPreferences.audienceAnswers || {},
          audienceQuestions: parsed.data.audienceQuestions !== undefined ? parsed.data.audienceQuestions : existingPreferences.audienceQuestions,
          audienceSuggestions: parsed.data.audienceSuggestions !== undefined ? parsed.data.audienceSuggestions : existingPreferences.audienceSuggestions,
          productionGuidelines: parsed.data.productionGuidelines || existingPreferences.productionGuidelines || "",
          tone: parsed.data.tone || existingPreferences.tone || "",
          toneDetails: parsed.data.toneDetails || existingPreferences.toneDetails || {},
          toneQuestions: parsed.data.toneQuestions !== undefined ? parsed.data.toneQuestions : existingPreferences.toneQuestions,
          goals: parsed.data.goals || existingPreferences.goals || "",
          visualPreferences: parsed.data.visualPreferences || existingPreferences.visualPreferences || {},
        };

        await upsertDynamicProfile({ userId: user.id, sector, name: profileName, purpose: parsed.data.purpose || "default", preferences });
      } catch (e) {
        console.error("DynamicProfile draft kayıt hatası:", e);
        // non-fatal
      }
      
      return new Response(JSON.stringify({ ok: true, draft: true }), { status: 200 });
    }

    // Final kayıt: Content DNA oluştur
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

    // Also upsert a DynamicProfile for multi-sector support. Use parsed.data.sector if provided, otherwise fallback to specialty or 'general'
    try {
      const sector = parsed.data.sector || parsed.data.specialty || "general";
      const profileName = parsed.data.profileName || `${sector} profile`;
      const preferences = {
        sector: parsed.data.sector || "",
        sectorArea: parsed.data.sectorArea || "",
        specialty: parsed.data.specialty || "",
        normalizedTone: cdna.normalizedTone,
        styleGuide: cdna.styleGuide || {},
        guardrails: cdna.guardrails || {},
        topics: cdna.topics || [],
        visualPreferences: parsed.data.visualPreferences || {},
        goals: parsed.data.goals || "",
        targetAudience: parsed.data.targetAudience || "",
        audienceAnswers: parsed.data.audienceAnswers || {},
        audienceQuestions: parsed.data.audienceQuestions || null,
        audienceSuggestions: parsed.data.audienceSuggestions || null,
        productionGuidelines: parsed.data.productionGuidelines || "",
        toneDetails: parsed.data.toneDetails || {},
        toneQuestions: parsed.data.toneQuestions || null,
      };

      await upsertDynamicProfile({ userId: user.id, sector, name: profileName, purpose: parsed.data.purpose || "default", preferences });
    } catch (e) {
      console.error("DynamicProfile upsert hata:", e);
      // non-fatal
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    console.error("Onboarding error", error);
    return new Response(JSON.stringify({ error: "Sunucu hatası" }), { status: 500 });
  }
}


