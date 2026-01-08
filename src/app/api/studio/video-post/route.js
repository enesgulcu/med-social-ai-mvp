// Türkçe yorum: Video Post hazırlama API endpoint'i; orchestrator'ı çağırır ve Asset kaydeder.

import { getServerSession } from "next-auth";
import prisma from "../../../../lib/prisma";
import { authOptions } from "../../../../lib/auth";
import { createVideoPost } from "../../../../features/studio/services/orchestrators";
import { archiveVideoParts } from "../../../../lib/archive";
import { checkRateLimit } from "../../../../lib/rateLimit";

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
    const { topic, notes = "", format = "9:16", addDisclaimer = true, voice = "alloy", includeDisclaimerInAudio = false, visualDesignRequest = "", enhancedPrompt = null } = body || {};
    const debugId = `api-videopost-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[studio][${debugId}][api] video-post request`, {
      userId: session.user.id,
      topicLen: (topic || "").length,
      format,
      voice,
      includeDisclaimerInAudio,
    });

    if (!topic || !topic.trim()) {
      return new Response(JSON.stringify({ error: "Konu gerekli" }), { status: 400 });
    }

    // Türkçe yorum: Orchestrator'ı çağır.
    const result = await createVideoPost({
      userId: session.user.id,
      topic: topic.trim(),
      notes: notes.trim(),
      format,
      addDisclaimer,
      voice,
      includeDisclaimerInAudio,
      enhancedPrompt: enhancedPrompt ? enhancedPrompt.trim() : null,
      visualDesignRequest: visualDesignRequest.trim(), // Görsel tasarım talebi
      // Türkçe yorum: Render endpoint'i oturum doğrulaması istediği için gelen isteğin Cookie bilgisini forward ediyoruz.
      requestCookie: req.headers.get("cookie") || "",
    });

    // Türkçe yorum: Asset kaydı - body'ye metadata ekle
    const bodyWithMetadata = {
      ...result.asset.body,
      metadata: {
        topic,
        notes,
        format,
        addDisclaimer,
        voice,
        includeDisclaimerInAudio,
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
        status: result.success ? "ready" : "error",
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

    // Türkçe yorum: Arşivleme — videoParts ise görseller/ses dataURL'lerini diske yazıp URL'lere çevir.
    try {
      if (asset.type === "videoParts") {
        const archivedBody = await archiveVideoParts({
          assetId: asset.id,
          userId: session.user.id,
          payload: asset.body,
          params: { topic, notes, format, addDisclaimer, voice, includeDisclaimerInAudio },
        });
        asset = await prisma.asset.update({
          where: { id: asset.id },
          data: { body: archivedBody, status: "ready" },
          include: { safetyChecks: true, variants: true },
        });
      }
    } catch (e) {
      console.warn("Arşivleme sırasında hata:", e);
    }

    return Response.json(
      {
        success: result.success,
        asset,
        errors: result.errors,
        usedMock: result.usedMock,
        debugId: result.debugId || debugId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Video post API error", error);
    return new Response(JSON.stringify({ error: "Sunucu hatası", message: error.message }), { status: 500 });
  }
}

