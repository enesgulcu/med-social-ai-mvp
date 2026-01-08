import { getServerSession } from "next-auth";
import prisma from "../../../lib/prisma";
import { authOptions } from "../../../lib/auth";
import { checkRateLimit } from "../../../lib/rateLimit";

// Türkçe yorum: Asset listeleme ve oluşturma; governance sonuçlarını opsiyonel kaydeder, usage log tutar.
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Yetkisiz" }), { status: 401 });
  }

  const url = new URL(req.url);
  const typeFilter = url.searchParams.get("type");
  const statusFilter = url.searchParams.get("status");
  // Pagination: allow `limit` query param, default to 50, cap to 200 to avoid heavy sorts
  const limitParam = parseInt(url.searchParams.get("limit") || "", 10);
  const take = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50;

  const where = { userId: session.user.id };
  if (typeFilter) where.type = typeFilter;
  if (statusFilter) where.status = statusFilter;

  // Use a limited findMany with orderBy on `id` (indexed) to avoid MongoDB in-memory sort issues.
  const assets = await prisma.asset.findMany({
    where,
    orderBy: { id: "desc" },
    take,
    include: { safetyChecks: true, variants: true },
  });

  return Response.json(assets);
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Yetkisiz" }), { status: 401 });
  }

  // Türkçe yorum: Rate limit kontrolü.
  const rateLimit = checkRateLimit(session.user.id, 10);
  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({
        error: "Rate limit aşıldı",
        message: `Dakikada maksimum 10 istek. ${Math.ceil((rateLimit.resetAt - Date.now()) / 1000)} saniye sonra tekrar deneyin.`,
      }),
      { status: 429 }
    );
  }

  const startTime = Date.now();

  try {
    const body = await req.json();
    const { type, title, payload, cdnaSnapshot = {}, safety, usedMock = false, provider = "openai" } = body || {};

    if (!type || !title || !payload) {
      return new Response(JSON.stringify({ error: "Eksik alan" }), { status: 400 });
    }

    const asset = await prisma.asset.create({
      data: {
        userId: session.user.id,
        type,
        title,
        body: payload,
        cdnaSnapshot,
        status: "ready",
        safetyChecks: safety
          ? {
              create: {
                verdict: safety.verdict,
                reasons: safety.reasons || [],
              },
            }
          : undefined,
      },
      include: { safetyChecks: true, variants: true },
    });

    // Türkçe yorum: Usage log kaydı (opsiyonel, hata olursa devam eder).
    try {
      await prisma.usageLog.create({
        data: {
          userId: session.user.id,
          actionType: type,
          provider: usedMock ? "mock" : provider,
          success: true,
          durationMs: Date.now() - startTime,
        },
      });
    } catch (logError) {
      console.error("Usage log error", logError);
      // Türkçe yorum: Log hatası asset oluşturmayı engellemez.
    }

    return Response.json(asset, { status: 201 });
  } catch (error) {
    // Türkçe yorum: Hata durumunda da log kaydı yapılır.
    try {
      await prisma.usageLog.create({
        data: {
          userId: session.user.id,
          actionType: "unknown",
          provider: "unknown",
          success: false,
          durationMs: Date.now() - startTime,
          errorCode: error.code || "UNKNOWN",
        },
      });
    } catch (logError) {
      // Ignore
    }

    console.error("Asset create error", error);
    return new Response(JSON.stringify({ error: "Sunucu hatası" }), { status: 500 });
  }
}


