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

    // Profil kaydı (upsert)
    await prisma.doctorProfile.upsert({
      where: { userId: user.id },
      create: { ...parsed.data, goals: parsed.data.goals, userId: user.id },
      update: { ...parsed.data, goals: parsed.data.goals },
    });

    // Türkçe yorum: Content DNA v2 üretimi (AI destekli + fallback).
    const cdna = await createOrUpdateContentDNAFromOnboarding(parsed.data);
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


