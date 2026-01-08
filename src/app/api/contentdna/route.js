// Türkçe yorum: Content DNA fetch endpoint; kullanıcının Content DNA'sını döndürür.

import { getServerSession } from "next-auth";
import prisma from "../../../lib/prisma";
import { authOptions } from "../../../lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Yetkisiz" }), { status: 401 });
  }

  try {
    const contentDNA = await prisma.contentDNA.findFirst({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
    });

    if (!contentDNA) {
      return new Response(JSON.stringify({ error: "Content DNA bulunamadı" }), { status: 404 });
    }

    return Response.json(contentDNA);
  } catch (error) {
    console.error("Content DNA fetch error", error);
    return new Response(JSON.stringify({ error: "Sunucu hatası" }), { status: 500 });
  }
}

