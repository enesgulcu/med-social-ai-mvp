// Türkçe yorum: Görsel Post hazırlama API endpoint'i; orchestrator'ı çağırır ve Asset kaydeder.

import { getServerSession } from "next-auth";
import prisma from "../../../../lib/prisma";
import { authOptions } from "../../../../lib/auth";
import { createImagePost } from "../../../../features/studio/services/orchestrators";
import { checkRateLimit } from "../../../../lib/rateLimit";
import { archiveImagePost } from "../../../../lib/archive";

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

  try {
    const body = await req.json();
    const { topic, notes = "", format = "9:16", addDisclaimer = true, visualDesignRequest = "", enhancedPrompt = null } = body || {};
    const debugId = `api-imagepost-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[studio][${debugId}][api] image-post request`, {
      userId: session.user.id,
      topicLen: (topic || "").length,
      format,
      addDisclaimer,
    });

    if (!topic || !topic.trim()) {
      return new Response(JSON.stringify({ error: "Konu gerekli" }), { status: 400 });
    }

    // Türkçe yorum: Orchestrator'ı çağır.
    const result = await createImagePost({
      userId: session.user.id,
      topic: topic.trim(),
      notes: notes.trim(),
      format,
      addDisclaimer,
      enhancedPrompt: enhancedPrompt ? enhancedPrompt.trim() : null,
      visualDesignRequest: visualDesignRequest.trim(), // Görsel tasarım talebi
    });

    if (!result.success) {
      return new Response(JSON.stringify({ error: "Üretim başarısız", errors: result.errors }), { status: 500 });
    }

    // Türkçe yorum: Asset kaydı - body'ye metadata ekle
    const bodyWithMetadata = {
      ...result.asset.body,
      metadata: {
        topic,
        notes,
        format,
        addDisclaimer,
        visualDesignRequest: visualDesignRequest || undefined,
        enhancedPrompt: enhancedPrompt ? enhancedPrompt : undefined,
        createdAt: new Date().toISOString(),
      },
    };

    let asset = await prisma.asset.create({
      data: {
        userId: session.user.id,
        type: result.asset.type,
        title: result.asset.title,
        body: bodyWithMetadata,
        cdnaSnapshot: result.asset.cdnaSnapshot,
        status: "ready",
        safetyChecks: result.asset.safety
          ? {
              create: {
                verdict: result.asset.safety.verdict,
                reasons: result.asset.safety.reasons || [],
              },
            }
          : undefined,
      },
      include: { safetyChecks: true, variants: true },
    });

    // Türkçe yorum: Arşivleme — imagePost ise dataURL görseli diske yazıp kısa URL ile değiştir.
    try {
      if (asset.type === "imagePost") {
        const archivedBody = await archiveImagePost({
          assetId: asset.id,
          userId: session.user.id,
          payload: asset.body,
          params: { topic, notes, format, addDisclaimer },
        });
        asset = await prisma.asset.update({
          where: { id: asset.id },
          data: { body: archivedBody, status: "ready" },
          include: { safetyChecks: true, variants: true },
        });
      }
    } catch (e) {
      console.warn("ImagePost arşivleme sırasında hata:", e);
    }

    return Response.json({
      success: true,
      asset,
      errors: result.errors,
      usedMock: result.usedMock,
      debugId: result.debugId || debugId,
    });
  } catch (error) {
    console.error("Image post API error", error);
    return new Response(JSON.stringify({ error: "Sunucu hatası", message: error.message }), { status: 500 });
  }
}

