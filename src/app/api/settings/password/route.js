import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import prisma from "../../../../lib/prisma";
import { authOptions } from "../../../../lib/auth";

// Türkçe yorum: Parola değişimi; eski parolayı doğrulayıp yeni hash yazar.
export async function PATCH(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Yetkisiz" }), { status: 401 });
  }

  const body = await req.json();
  const { currentPassword, newPassword } = body || {};
  if (!currentPassword || !newPassword) {
    return new Response(JSON.stringify({ error: "Eksik alan" }), { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return new Response(JSON.stringify({ error: "Kullanıcı yok" }), { status: 404 });

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return new Response(JSON.stringify({ error: "Eski parola yanlış" }), { status: 403 });

  const newHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });

  return Response.json({ ok: true });
}


