import { getServerSession } from "next-auth";
import prisma from "../../../../lib/prisma";
import { authOptions } from "../../../../lib/auth";

// Türkçe yorum: Asset detayını getirir ve varyasyon ekler; mock payload ile çalışır.
export async function GET(_req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Yetkisiz" }), { status: 401 });
  }

  const asset = await prisma.asset.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: { safetyChecks: true, variants: true },
  });

  if (!asset) return new Response(JSON.stringify({ error: "Bulunamadı" }), { status: 404 });
  return Response.json(asset);
}

export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Yetkisiz" }), { status: 401 });
  }

  try {
    const asset = await prisma.asset.findFirst({
      where: { id: params.id, userId: session.user.id },
      include: { variants: true },
    });
    if (!asset) return new Response(JSON.stringify({ error: "Bulunamadı" }), { status: 404 });

    const { payload } = await req.json();
    const nextVersion = (asset.variants?.length || 0) + 1;
    const variantPayload = payload || { note: "Mock varyasyon", baseTitle: asset.title };

    await prisma.assetVariant.create({
      data: { assetId: asset.id, version: nextVersion, payload: variantPayload },
    });

    const updated = await prisma.asset.findFirst({
      where: { id: asset.id },
      include: { safetyChecks: true, variants: true },
    });

    return Response.json(updated);
  } catch (error) {
    console.error("Variant error", error);
    return new Response(JSON.stringify({ error: "Sunucu hatası" }), { status: 500 });
  }
}


