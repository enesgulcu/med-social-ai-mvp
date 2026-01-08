// Türkçe yorum: Yerel dosya arşivleme yardımcıları. Amaç: üretilen medya dosyalarını
// .media altında saklamak ve indirilebilir URL (/api/media/:id) üretmek.

import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import path from "path";

// Türkçe yorum: Arşiv dizinini belirler; proje kökünde .media yoksa OS tmp kullanılır.
export function getMediaDir() {
  try {
    const dir = path.join(process.cwd(), ".media");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  } catch (_e) {
    const tmp = path.join(os.tmpdir(), "social-agent-media");
    if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });
    return tmp;
  }
}

// Türkçe yorum: data URL içeriğini verilen dosya yoluna yazar.
export async function writeDataUrlToFile(dataUrl, outPath) {
  const comma = dataUrl.indexOf(",");
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const buffer = Buffer.from(base64, "base64");
  await fsp.writeFile(outPath, buffer);
}

// Türkçe yorum: Medya kimliği üretir.
function genId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Türkçe yorum: Video parçaları (text + images + audio + captions) için arşiv oluşturur.
// dataUrl görseller/sesler varsa diske yazılır ve /api/media/:id URL'leri döndürülür.
export async function archiveVideoParts({ assetId, userId, payload, params }) {
  const mediaDir = getMediaDir();
  const updated = JSON.parse(JSON.stringify(payload));

  // Görselleri kaydet
  if (Array.isArray(updated.images)) {
    for (let i = 0; i < updated.images.length; i++) {
      const item = updated.images[i];
      const url = item?.url;
      if (typeof url === "string" && url.startsWith("data:image/")) {
        const mime = url.substring(5, url.indexOf(";")) || "image/png";
        const ext = mime.endsWith("jpeg") ? "jpg" : mime.split("/")[1] || "png";
        const mediaId = `img-${assetId}-${i + 1}`;
        const filePath = path.join(mediaDir, `${mediaId}.${ext}`);
        await writeDataUrlToFile(url, filePath);
        updated.images[i].url = `/api/media/${mediaId}`;
        updated.images[i].mediaId = mediaId;
      }
    }
  }

  // Sesi kaydet
  if (updated.audio?.audioUrl && typeof updated.audio.audioUrl === "string" && updated.audio.audioUrl.startsWith("data:audio/")) {
    const mime = updated.audio.audioUrl.substring(5, updated.audio.audioUrl.indexOf(";")) || "audio/mpeg";
    const ext = mime.split("/")[1] || "mp3";
    const mediaId = `aud-${assetId}`;
    const filePath = path.join(mediaDir, `${mediaId}.${ext}`);
    await writeDataUrlToFile(updated.audio.audioUrl, filePath);
    updated.audio.audioUrl = `/api/media/${mediaId}`;
    updated.audio.mediaId = mediaId;
  }

  // Türkçe yorum: Parametreleri ve özet bilgiyi JSON olarak kaydet (opsiyonel ama faydalı).
  const metaPath = path.join(mediaDir, `${assetId}.json`);
  const meta = {
    assetId,
    userId,
    type: "videoParts",
    savedAt: new Date().toISOString(),
    params: params || {},
    format: updated.format,
    duration: updated.duration,
    counts: {
      images: Array.isArray(updated.images) ? updated.images.length : 0,
      captions: Array.isArray(updated.captions) ? updated.captions.length : 0,
    },
  };
  try {
    await fsp.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8");
  } catch (_e) {
    // meta yazılamazsa üretim devam eder
  }

  // Asset body içine parametreleri de göm (kolay erişim için).
  updated.params = params || {};

  return updated;
}

// Türkçe yorum: ImagePost (metin + tek görsel) için arşiv oluşturur.
// Görsel dataURL ise diske yazar ve URL'yi /api/media/... ile değiştirir.
export async function archiveImagePost({ assetId, userId, payload, params }) {
  const mediaDir = getMediaDir();
  const updated = JSON.parse(JSON.stringify(payload));

  const imgUrl = updated?.image?.imageUrl;
  if (typeof imgUrl === "string" && imgUrl.startsWith("data:image/")) {
    const mime = imgUrl.substring(5, imgUrl.indexOf(";")) || "image/png";
    const ext = mime.endsWith("jpeg") ? "jpg" : mime.split("/")[1] || "png";
    const mediaId = `img-${assetId}`;
    const filePath = path.join(mediaDir, `${mediaId}.${ext}`);
    await writeDataUrlToFile(imgUrl, filePath);
    updated.image.imageUrl = `/api/media/${mediaId}`;
    updated.image.mediaId = mediaId;
  }

  // Türkçe yorum: Parametreleri ve özet bilgiyi JSON olarak kaydet.
  const metaPath = path.join(mediaDir, `${assetId}.json`);
  const meta = {
    assetId,
    userId,
    type: "imagePost",
    savedAt: new Date().toISOString(),
    params: params || {},
    format: updated?.image?.format || updated?.image?.meta?.format || null,
    usedPrompt: updated?.image?.usedPrompt || "",
  };
  try {
    await fsp.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8");
  } catch (_e) {
    // meta yazılamazsa üretim devam eder
  }

  // Türkçe yorum: Parametreleri asset body içine de göm.
  updated.params = params || {};

  return updated;
}


