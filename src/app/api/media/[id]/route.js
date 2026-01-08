// Türkçe yorum: Media serving; ses ve video dosyalarını serve eder. DB'de Asset.body içinde mediaRef ile saklanır.

import { getServerSession } from "next-auth";
import prisma from "../../../../lib/prisma";
import { authOptions } from "../../../../lib/auth";
import fs from "fs";
import path from "path";
import os from "os";

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Yetkisiz" }), { status: 401 });
  }

  try {
    const mediaId = params.id;

    // Türkçe yorum: Önce yerel diskten dosya serve etmeyi dener (.media/<id>.mp4 | .mp3).
    const baseDir = (() => {
      try {
        return fs.existsSync(path.join(process.cwd(), ".media")) ? path.join(process.cwd(), ".media") : path.join(os.tmpdir(), "social-agent-media");
      } catch (_e) {
        return path.join(os.tmpdir(), "social-agent-media");
      }
    })();

    // Türkçe yorum: Önce dosya adını direkt dene (extension dahil), sonra extension'ları dene
    let filePath = path.join(baseDir, mediaId);
    if (!fs.existsSync(filePath)) {
      const candidates = [".mp4", ".mp3", ".wav", ".png", ".jpg", ".jpeg", ".webp"].map((ext) => path.join(baseDir, `${mediaId}${ext}`));
      filePath = candidates.find((p) => fs.existsSync(p));
    }
    if (filePath) {
      const stat = fs.statSync(filePath);
      const range = req.headers.get("Range");
      const mime = filePath.endsWith(".mp4")
        ? "video/mp4"
        : filePath.endsWith(".mp3")
        ? "audio/mpeg"
        : filePath.endsWith(".png")
        ? "image/png"
        : filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")
        ? "image/jpeg"
        : filePath.endsWith(".webp")
        ? "image/webp"
        : "application/octet-stream";

      // Türkçe yorum: Range desteği (video için).
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunkSize = end - start + 1;
        const stream = fs.createReadStream(filePath, { start, end });
        return new Response(stream, {
          status: 206,
          headers: {
            "Content-Range": `bytes ${start}-${end}/${stat.size}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunkSize.toString(),
            "Content-Type": mime,
          },
        });
      }

      const stream = fs.createReadStream(filePath);
      return new Response(stream, {
        headers: {
          "Content-Length": stat.size.toString(),
          "Content-Type": mime,
        },
      });
    }

    // Türkçe yorum: Yerel dosya bulunamazsa eski davranış: Asset üzerinden servis.
    const assetId = mediaId;
    const asset = await prisma.asset.findFirst({
      where: {
        id: assetId,
        userId: session.user.id,
      },
    });

    if (!asset) {
      return new Response(JSON.stringify({ error: "Asset bulunamadı" }), { status: 404 });
    }

    // Türkçe yorum: Asset.body içinde mediaRef veya audioUrl/videoUrl aranır.
    const body = asset.body || {};
    const mediaUrl = body.audioUrl || body.videoUrl || body.imageUrl || body.mediaRef;

    if (!mediaUrl) {
      return new Response(
        JSON.stringify({ error: "Media URL bulunamadı", message: "Bu asset için medya dosyası üretilmemiş." }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Türkçe yorum: Base64 data URL ise decode edilip serve edilir.
    if (mediaUrl.startsWith("data:")) {
      const [header, base64] = mediaUrl.split(",");
      const mimeType = header.match(/data:([^;]+)/)?.[1] || "application/octet-stream";
      const buffer = Buffer.from(base64, "base64");

      return new Response(buffer, {
        headers: {
          "Content-Type": mimeType,
          "Content-Length": buffer.length.toString(),
        },
      });
    }

    // Türkçe yorum: External URL ise redirect yapılır.
    return Response.redirect(mediaUrl, 302);
  } catch (error) {
    console.error("Media serve error", error);
    return new Response(JSON.stringify({ error: "Sunucu hatası" }), { status: 500 });
  }
}

