import bcrypt from "bcryptjs";
import prisma from "../../../lib/prisma";

// Türkçe yorum: Basit register endpoint; email benzersiz olmalı, parola hash'lenir.
export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password, name } = body || {};

    // Savunmacı kontrol: eksik alanları reddet.
    if (!email || !password || !name) {
      return new Response(JSON.stringify({ error: "Eksik alan" }), { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return new Response(JSON.stringify({ error: "Bu email zaten kayıtlı" }), { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { email, passwordHash, name, role: "doctor" },
    });

    return new Response(JSON.stringify({ ok: true }), { status: 201 });
  } catch (error) {
    console.error("Register error", error);
    return new Response(JSON.stringify({ error: "Sunucu hatası" }), { status: 500 });
  }
}

