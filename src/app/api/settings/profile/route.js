import { getServerSession } from "next-auth";
import prisma from "../../../../lib/prisma";
import { authOptions } from "../../../../lib/auth";

// Türkçe yorum: Profil güncelleme (isim); diğer işlemlerden izole çalışır.
export async function PATCH(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Yetkisiz" }), { status: 401 });
  }

  const body = await req.json();
  if (!body?.name) {
    return new Response(JSON.stringify({ error: "İsim gerekli" }), { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { name: body.name },
  });

  return Response.json({ ok: true, user });
}


