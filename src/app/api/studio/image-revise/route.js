// Türkçe yorum: Görsel revizyon API endpoint'i; alternatif üretme veya kullanıcı yorumu ile revizyon yapar.

import { getServerSession } from "next-auth";
import prisma from "../../../../lib/prisma";
import { authOptions } from "../../../../lib/auth";
import { createImagePost } from "../../../../features/studio/services/orchestrators";
import { checkRateLimit } from "../../../../lib/rateLimit";
import { archiveImagePost } from "../../../../lib/archive";
import { callOpenAIChat } from "../../../../lib/ai/openaiClient";
import { createImage } from "../../../../lib/ai/nanoBananaClient";

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
    const { assetId, revisionType, userRequest = "", format = "9:16" } = body || {};

    if (!assetId) {
      return new Response(JSON.stringify({ error: "Asset ID gerekli" }), { status: 400 });
    }

    // Eski asset'i al
    const oldAsset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: { user: { include: { profile: true, contentDNA: { orderBy: { updatedAt: "desc" }, take: 1 } } } },
    });

    if (!oldAsset || oldAsset.userId !== session.user.id) {
      return new Response(JSON.stringify({ error: "Asset bulunamadı veya yetkisiz" }), { status: 404 });
    }

    if (oldAsset.type !== "image916" && oldAsset.type !== "image169") {
      return new Response(JSON.stringify({ error: "Sadece görsel asset'ler revize edilebilir" }), { status: 400 });
    }

    const debugId = `api-imagerevise-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[studio][${debugId}][api] image-revise request`, {
      userId: session.user.id,
      assetId,
      revisionType,
      hasUserRequest: !!userRequest,
    });

    // Eski görsel URL'i
    const oldImageUrl = oldAsset.body?.imageUrl;
    const oldTopic = oldAsset.body?.metadata?.topic || oldAsset.title;
    const oldNotes = oldAsset.body?.metadata?.notes || "";
    const oldVisualDesignRequest = oldAsset.body?.metadata?.visualDesignRequest || "";

    let newNotes = oldNotes;
    let enhancedPrompt = "";

    if (revisionType === "alternative") {
      // Alternatif üret - AI otomatik alternatif üretir
      newNotes = `${oldNotes ? oldNotes + " " : ""}[Alternatif versiyon]`;
      enhancedPrompt = "Bu görsel için alternatif bir versiyon üret. Aynı konu ve stilde ama farklı bir kompozisyon, renk paleti veya görsel yaklaşım kullan.";
    } else if (revisionType === "revise" && userRequest.trim()) {
      // Revize et - kullanıcı yorumu ile
      newNotes = `${oldNotes ? oldNotes + " " : ""}[Revizyon: ${userRequest.trim()}]`;
      
      // Eski görseli AI'ya göster ve kullanıcı yorumunu analiz et
      const revisionPrompt = `Kullanıcı mevcut bir görseli revize etmek istiyor.

ESKİ GÖRSEL BİLGİLERİ:
- Konu: ${oldTopic}
- Önceki Notlar: ${oldNotes || "Yok"}
- Format: ${format}

KULLANICI REVİZYON TALEBİ:
"${userRequest.trim()}"

GÖREV:
1. Kullanıcının revizyon talebini dikkatle analiz et
2. Eski görselin konusunu ve stilini koru
3. Kullanıcının istediği değişiklikleri uygula
4. Yeni görsel için detaylı bir prompt oluştur

ÖNEMLİ:
- Kullanıcının talebi ÇOK ÖNEMLİ, mutlaka dikkate alınmalı
- Eski görselin genel konseptini koru ama kullanıcının istediği değişiklikleri yap
- Yeni görsel kullanıcının talebine göre üretilmeli

Yeni görsel için prompt'u oluştur (sadece prompt, başka açıklama yok):`;

      const revisionResult = await callOpenAIChat({
        system: "Sen bir görsel tasarım uzmanısın. Kullanıcıların görsel revizyon taleplerini anlayıp, yeni görsel üretimi için detaylı prompt'lar oluşturuyorsun.",
        user: revisionPrompt,
        temperature: 0.7,
        maxTokens: 300,
        responseJson: false,
      });

      if (revisionResult.ok && revisionResult.data) {
        enhancedPrompt = revisionResult.data.trim();
        console.log(`[studio][${debugId}][api] Revision prompt generated:`, enhancedPrompt);
      } else {
        // Fallback: Kullanıcı yorumunu direkt prompt'a ekle
        enhancedPrompt = `${oldAsset.body?.usedPrompt || oldTopic}. ${userRequest.trim()}`;
      }
      
      // Yazım kurallarını ekle
      enhancedPrompt += `\n\n⚠️ YAZIM KURALLARI (ÇOK ÖNEMLİ):
- Görsel üzerinde yazı varsa, yazılar TAM OLARAK doğru yazılmalı, yazım hatası OLMAMALI.
- Türkçe karakterler (ı, ş, ğ, ü, ö, ç) doğru kullanılmalı.
- Kelimeler eksik veya fazla harf içermemeli.
- Yazılar düzgün, okunabilir ve net olmalı.
- Yazılar kaymamalı, düzgün hizalı olmalı.
- Eğer görselde yazı yoksa, bu kural uygulanmaz.`;
    } else {
      return new Response(JSON.stringify({ error: "Revizyon tipi veya kullanıcı talebi gerekli" }), { status: 400 });
    }

    // Yeni görsel üret
    const result = await createImagePost({
      userId: session.user.id,
      topic: oldTopic,
      notes: newNotes,
      format,
      addDisclaimer: oldAsset.body?.metadata?.addDisclaimer !== false,
      enhancedPrompt: enhancedPrompt || undefined, // Eğer enhanced prompt varsa kullan
      visualDesignRequest: oldVisualDesignRequest || undefined, // Eski görsel tasarım talebini koru
    });

    if (!result.success) {
      return new Response(JSON.stringify({ error: "Revizyon başarısız", errors: result.errors }), { status: 500 });
    }

    // Türkçe yorum: Asset kaydı - body'ye metadata ekle
    const bodyWithMetadata = {
      ...result.asset.body,
      metadata: {
        ...oldAsset.body?.metadata,
        topic: oldTopic,
        notes: newNotes,
        format,
        addDisclaimer: oldAsset.body?.metadata?.addDisclaimer !== false,
        revisionType,
        originalAssetId: assetId,
        userRequest: userRequest || undefined,
        visualDesignRequest: oldVisualDesignRequest || undefined,
        createdAt: new Date().toISOString(),
      },
    };

    let newAsset = await prisma.asset.create({
      data: {
        userId: session.user.id,
        type: result.asset.type,
        title: `${oldTopic} ${revisionType === "alternative" ? "(Alternatif)" : "(Revize)"}`,
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

    // Türkçe yorum: Arşivleme
    try {
      if (newAsset.type === "imagePost") {
        const archivedBody = await archiveImagePost({
          assetId: newAsset.id,
          userId: session.user.id,
          payload: newAsset.body,
          params: { topic: oldTopic, notes: newNotes, format, addDisclaimer: oldAsset.body?.metadata?.addDisclaimer !== false },
        });
        newAsset = await prisma.asset.update({
          where: { id: newAsset.id },
          data: { body: archivedBody, status: "ready" },
          include: { safetyChecks: true, variants: true },
        });
      }
    } catch (e) {
      console.warn("ImagePost arşivleme sırasında hata:", e);
    }

    return Response.json({
      success: true,
      asset: newAsset,
      errors: result.errors,
      usedMock: result.usedMock,
      debugId: result.debugId || debugId,
    });
  } catch (error) {
    console.error("Image revise API error", error);
    return new Response(JSON.stringify({ error: "Sunucu hatası", message: error.message }), { status: 500 });
  }
}
