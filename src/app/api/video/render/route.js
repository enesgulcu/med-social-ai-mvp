// Türkçe yorum: FFmpeg tabanlı video render endpoint'i.
// Ek paket yok; child_process ile sistemdeki ffmpeg binary'si çağrılır.
// Girdi: images (3-6), timeline (start,duration,caption), audioDataUrl (opsiyonel), captions, format.
// Çıktı: { ok:true, mediaId, videoUrl }

import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import { spawnSync, spawn } from "child_process";

// Türkçe yorum: Basit benzersiz id üretici (ek kütüphane yok).
function generateId(prefix = "media") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Türkçe yorum: path güvenli bir şekilde oluşturulur (cross-platform).
function getMediaDir() {
  const preferred = path.join(process.cwd(), ".media");
  try {
    if (!fs.existsSync(preferred)) {
      fs.mkdirSync(preferred, { recursive: true });
    }
    return preferred;
  } catch (_e) {
    // Windows veya read-only sorunlarında OS tmp düşer
    const tmp = path.join(os.tmpdir(), "social-agent-media");
    if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });
    return tmp;
  }
}

// Türkçe yorum: data URL'yi diske yazar.
async function writeDataUrlToFile(dataUrl, outPath) {
  const [header, base64] = dataUrl.split(",");
  const buffer = Buffer.from(base64, "base64");
  await fsp.writeFile(outPath, buffer);
}

// Türkçe yorum: URL'den veya dataURL'den görseli indirip kaydeder; yoksa placeholder üretir.
async function materializeImage(urlOrData, outPath, width, height) {
  try {
    if (!urlOrData) throw new Error("no image");
    if (urlOrData.startsWith("data:")) {
      await writeDataUrlToFile(urlOrData, outPath);
      return true;
    }
    if (urlOrData.startsWith("http")) {
      const res = await fetch(urlOrData);
      if (!res.ok) throw new Error("download failed");
      const buf = Buffer.from(await res.arrayBuffer());
      await fsp.writeFile(outPath, buf);
      return true;
    }
  } catch (_e) {
    // ignore, placeholder'a düş
  }
  // Türkçe yorum: 1x1 beyaz PNG (base64) - placeholder
  const whitePngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
  await writeDataUrlToFile(`data:image/png;base64,${whitePngBase64}`, outPath);
  return false;
}

// Türkçe yorum: SRT içeriği üretir.
function buildSrt(captions = []) {
  const toTime = (s) => {
    const ms = Math.floor((s - Math.floor(s)) * 1000);
    const total = Math.floor(s);
    const hh = String(Math.floor(total / 3600)).padStart(2, "0");
    const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const ss = String(total % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss},${String(ms).padStart(3, "0")}`;
  };
  return captions
    .map((c, i) => `${i + 1}\n${toTime(c.start)} --> ${toTime(c.end)}\n${c.text || ""}\n`)
    .join("\n");
}

// Türkçe yorum: FFmpeg komutunu belirler (FFMPEG_PATH varsa onu kullanır) ve erişilebilirliği döndürür.
function getFfmpegCmd() {
  const custom = process.env.FFMPEG_PATH && process.env.FFMPEG_PATH.trim();
  const candidate = custom || "ffmpeg";
  try {
    const r = spawnSync(candidate, ["-version"], { stdio: "ignore" });
    return { cmd: candidate, available: r.status === 0 };
  } catch (_e) {
    return { cmd: candidate, available: false };
  }
}

function hasFfmpeg() {
  return getFfmpegCmd().available;
}

// Türkçe yorum: Render uygunluk kontrolü (GET) - UI butonunu yönetmek için.
export async function GET() {
  // Türkçe yorum: Env set edilmemişse ve FFmpeg varsa otomatik ffmpeg moduna geç.
  const envMode = process.env.VIDEO_RENDER_MODE || "";
  const ff = getFfmpegCmd();
  const mode = envMode === "ffmpeg" || (envMode === "" && ff.available) ? "ffmpeg" : "mock";
  const ready = mode === "ffmpeg" ? ff.available : false;
  return Response.json({ ok: ready, ready, mode }, { status: 200 });
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Yetkisiz" }), { status: 401 });
  }

  try {
    const body = await req.json();
    const debugId = body?.debugId || `render-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const images = Array.isArray(body.images) ? body.images : [];
    const timeline = Array.isArray(body.timeline) ? body.timeline : [];
    const captions = Array.isArray(body.captions) ? body.captions : [];
    const audioDataUrl = body.audioDataUrl || null;
    const format = body.format === "16:9" ? "16:9" : "9:16";

    // Türkçe yorum: Env yoksa ve FFmpeg erişilebilir ise otomatik ffmpeg kullan.
    const envMode = process.env.VIDEO_RENDER_MODE || "";
    const ff = getFfmpegCmd();
    const mode = envMode === "ffmpeg" || (envMode === "" && ff.available) ? "ffmpeg" : "mock";
    console.log(`[video-render][${debugId}] start`, {
      userId: session.user.id,
      mode,
      format,
      imagesCount: images.length,
      timelineCount: timeline.length,
      captionsCount: captions.length,
      audioDataUrl: typeof audioDataUrl === "string" ? `dataUrl len=${audioDataUrl.length}` : audioDataUrl ? "non-string" : "none",
    });

    // Türkçe yorum: ffmpeg kontrolü ve hata üretimi
    if (mode !== "ffmpeg") {
      const payload =
        envMode === "mock"
          ? { errorCode: "RENDER_MODE_NOT_FFMPEG", message: "Video üretimi için VIDEO_RENDER_MODE=ffmpeg olmalıdır." }
          : { errorCode: "FFMPEG_NOT_FOUND", message: "Video üretimi için FFmpeg gereklidir." };
      return new Response(JSON.stringify(payload), { status: 503 });
    }
    if (!ff.available) {
      return new Response(
        JSON.stringify({
          errorCode: "FFMPEG_NOT_FOUND",
          message: "Video üretimi için FFmpeg gereklidir.",
        }),
        {
        status: 503,
        }
      );
    }

    const mediaDir = getMediaDir();
    const workId = generateId("render");
    const workDir = path.join(mediaDir, workId);
    await fsp.mkdir(workDir, { recursive: true });

    const size = format === "16:9" ? { w: 1920, h: 1080 } : { w: 1080, h: 1920 };
    const fps = 30;
    const fadeDur = 0.6;

    // 1) Görselleri materialize et
    const materialized = [];
    for (let i = 0; i < timeline.length; i++) {
      const img = images[i]?.url || images[i];
      const imgPath = path.join(workDir, `img_${i + 1}.png`);
      await materializeImage(img, imgPath, size.w, size.h);
      materialized.push({ path: imgPath, duration: Math.max(1, Number(timeline[i]?.duration || 3)) });
    }
    if (materialized.length === 0) {
      return new Response(JSON.stringify({ errorCode: "NO_IMAGES", message: "Görsel girişi yok" }), { status: 400 });
    }

    // 2) Audio dosyasını yaz
    let audioPath = null;
    if (audioDataUrl && typeof audioDataUrl === "string" && audioDataUrl.startsWith("data:")) {
      audioPath = path.join(workDir, "voice.mp3");
      await writeDataUrlToFile(audioDataUrl, audioPath);
    }

    // 3) SRT oluştur
    let srtPath = null;
    if (captions.length > 0) {
      srtPath = path.join(workDir, "subs.srt");
      await fsp.writeFile(srtPath, buildSrt(captions), "utf8");
    }

    // 4) ffmpeg komutu derle
    const inputArgs = [];
    materialized.forEach((m) => {
      inputArgs.push("-loop", "1", "-t", String(m.duration), "-i", m.path);
    });
    if (audioPath) {
      inputArgs.push("-i", audioPath);
    }
    if (srtPath) {
      inputArgs.push("-itsoffset", "0");
    }

    // filter_complex inşası (Ken Burns + xfade + subtitles)
    const segLabels = [];
    const filterParts = [];
    materialized.forEach((m, idx) => {
      const frames = Math.max(1, Math.round(m.duration * fps));
      const inLabel = `${idx}:v`;
      const outLabel = `v${idx}`;
      segLabels.push(outLabel);
      filterParts.push(
        `[${inLabel}]scale=${size.w}:${size.h}:force_original_aspect_ratio=cover,zoompan=z='min(zoom+0.001,1.08)':d=${frames}:s=${size.w}x${size.h}:fps=${fps},setsar=1,format=yuv420p[${outLabel}]`
      );
    });

    // xfade zinciri
    let last = segLabels[0];
    let offset = Math.max(0, materialized[0].duration - fadeDur);
    for (let i = 1; i < segLabels.length; i++) {
      const cur = segLabels[i];
      const out = `vx${i}`;
      filterParts.push(`[${last}][${cur}]xfade=transition=fade:duration=${fadeDur}:offset=${offset.toFixed(2)}[${out}]`);
      last = out;
      offset += materialized[i].duration;
    }

    // subtitles burn-in
    let videoMap = last;
    if (srtPath) {
      // Windows path kaçışları
      const esc = srtPath.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
      const out = "vout";
      filterParts.push(`[${videoMap}]subtitles='${esc}':force_style='Fontsize=24,BorderStyle=3'[${out}]`);
      videoMap = out;
    }

    const filterComplex = filterParts.join(";");

    const outId = generateId("vid");
    const outPath = path.join(getMediaDir(), `${outId}.mp4`);

    const args = [
      ...inputArgs,
      "-filter_complex",
      filterComplex,
      "-map",
      `[${videoMap}]`,
    ];
    if (audioPath) {
      args.push("-map", `${materialized.length}:a?`);
    }
    args.push(
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-shortest",
      "-movflags",
      "+faststart",
      outPath
    );

    // Türkçe yorum: stderr/stdout toplanır (son 4000 karakter) ki hata teşhisi kolay olsun.
    const proc = spawn(ff.cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let outTail = "";
    let errTail = "";
    proc.stdout.on("data", (d) => {
      outTail = (outTail + d.toString("utf8")).slice(-4000);
    });
    proc.stderr.on("data", (d) => {
      errTail = (errTail + d.toString("utf8")).slice(-4000);
    });

    const exitCode = await new Promise((resolve) => {
      proc.on("close", resolve);
    });

    if (exitCode !== 0 || !fs.existsSync(outPath)) {
      console.error(`[video-render][${debugId}] ffmpeg failed`, { exitCode, outPath, errTail, outTail });
      return new Response(JSON.stringify({ errorCode: "RENDER_FAILED", message: "Video render başarısız" }), {
        status: 500,
      });
    }

    const videoUrl = `/api/media/${outId}`;
    const duration = materialized.reduce((sum, m) => sum + m.duration, 0);
    console.log(`[video-render][${debugId}] success`, { outId, outPath, videoUrl, duration });
    return Response.json({ ok: true, mediaId: outId, videoUrl, duration, format, captionsCount: captions.length });
  } catch (error) {
    console.error("Video render route error:", error);
    return new Response(JSON.stringify({ errorCode: "SERVER_ERROR", message: error.message }), { status: 500 });
  }
}


