// Türkçe yorum: Onboarding sırasında görsel yükleme endpoint'i (ton belirleme için).

import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import os from "os";

function ensureMediaDir() {
  const preferred = path.join(process.cwd(), ".media");
  try {
    if (!fs.existsSync(preferred)) fs.mkdirSync(preferred, { recursive: true });
    return preferred;
  } catch (_e) {
    const fallback = path.join(os.tmpdir(), "social-agent-media");
    if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

function genId() {
  return `onboarding-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Yetkisiz" }), { status: 401 });
  }

  try {
    const form = await req.formData();
    const files = form.getAll("images");
    if (!files || files.length === 0) {
      return new Response(JSON.stringify({ error: "Dosya yüklenmedi" }), { status: 400 });
    }

    // Maksimum 5 görsel
    const limitedFiles = files.slice(0, 5);
    const mediaDir = ensureMediaDir();

    const imageUrls = [];
    const items = [];

    for (const file of limitedFiles) {
      const id = genId();
      const origName = file.name || "upload.bin";
      const ext = path.extname(origName) || ".jpg";
      const outPath = path.join(mediaDir, `${id}${ext}`);

      const buf = Buffer.from(await file.arrayBuffer());
      await fsp.writeFile(outPath, buf);

      // URL oluştur (local development için) - dosya adını kullan
      const filename = `${id}${ext}`;
      const imageUrl = `/api/media/${filename}`;
      imageUrls.push(imageUrl);
      items.push({
        id,
        filename: `${id}${ext}`,
        mime: file.type || "image/jpeg",
        size: buf.length,
        url: imageUrl,
      });
    }

    return Response.json({ ok: true, imageUrls, items });
  } catch (error) {
    console.error("Onboarding görsel yükleme hatası:", error);
    return new Response(JSON.stringify({ error: "Sunucu hatası", message: error.message }), { status: 500 });
  }
}
