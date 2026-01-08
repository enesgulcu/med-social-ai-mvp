"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Card from "../../../components/Card";
import Button from "../../../components/Button";
import PageHeader from "../../../components/PageHeader";
import Input from "../../../components/Input";
import Textarea from "../../../components/Textarea";
import Select from "../../../components/Select";
import { useAssetStore } from "../../../features/assets/store";

// Türkçe yorum: Studio sayfası; sadeleştirilmiş UX ile 2 ana aksiyon: Görsel Post ve Video Post.
export default function StudioPage() {
  const { data: session } = useSession();
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [format, setFormat] = useState("9:16");
  const [target, setTarget] = useState("bilgilendirme");
  const [voice, setVoice] = useState("alloy");
  const [includeDisclaimerInAudio, setIncludeDisclaimerInAudio] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState([]);
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState([]);
  const [usedMock, setUsedMock] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const { upsertAsset } = useAssetStore();
  const [ffmpegInfo, setFfmpegInfo] = useState({ ready: null, mode: null });
  const [ffmpegAlert, setFfmpegAlert] = useState(false);
  const [lastDebugId, setLastDebugId] = useState("");

  // Türkçe yorum: FFmpeg durumu DEV MODE için okunur; buton kilitlemek için kullanılmaz.
  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch("/api/video/render", { method: "GET" });
        const d = await r.json();
        setFfmpegInfo({ ready: !!d.ready, mode: d.mode || null });
      } catch (_e) {
        setFfmpegInfo({ ready: false, mode: null });
      }
    };
    check();
  }, []);

  // Türkçe yorum: Görsel Post hazırlama.
  const handleCreateImagePost = async () => {
    if (!topic.trim()) {
      setErrors([{ step: "Giriş", message: "Konu gerekli" }]);
      return;
    }

    setLoading(true);
    setProgress([]);
    setResult(null);
    setErrors([]);
    setUsedMock(false);

    try {
      setProgress([{ step: "Metin üretiliyor...", status: "loading" }]);
      const res = await fetch("/api/studio/image-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          notes,
          format,
          addDisclaimer: true,
          voice,
          includeDisclaimerInAudio,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        setErrors([{ step: "API", message: errorData.error || "İstek başarısız" }]);
        return;
      }

      const data = await res.json();
      setResult(data.asset);
      setErrors(data.errors || []);
      setUsedMock(data.usedMock || false);
      setLastDebugId(data.debugId || "");
      upsertAsset(data.asset);

      setProgress([{ step: "Tamamlandı", status: "success" }]);
    } catch (error) {
      console.error("Görsel post hatası:", error);
      setErrors([{ step: "Hata", message: error.message || "Bilinmeyen hata" }]);
    } finally {
      setLoading(false);
    }
  };

  // Türkçe yorum: Video Post hazırlama.
  const handleCreateVideoPost = async () => {
    if (!topic.trim()) {
      setErrors([{ step: "Giriş", message: "Konu gerekli" }]);
      return;
    }

    setLoading(true);
    setProgress([]);
    setResult(null);
    setErrors([]);
    setUsedMock(false);
    setFfmpegAlert(false);

    try {
      setProgress([{ step: "Metin üretiliyor...", status: "loading" }]);
      const res = await fetch("/api/studio/video-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          notes,
          format,
          addDisclaimer: true,
          voice,
          includeDisclaimerInAudio,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        setErrors([{ step: "API", message: errorData.error || "İstek başarısız" }]);
        return;
      }

      const data = await res.json();
      setResult(data.asset);
      setErrors(data.errors || []);
      setUsedMock(data.usedMock || false);
      setLastDebugId(data.debugId || "");
      upsertAsset(data.asset);

      // Türkçe yorum: Başarı sadece backend success:true ise success sayılır.
      setProgress([{ step: data.success ? "Tamamlandı" : "Başarısız", status: data.success ? "success" : "error" }]);

      // Türkçe yorum: FFmpeg yoksa backend hata döndürür; kullanıcıya net uyarı gösterilir.
      const hasFfmpegNotFound =
        Array.isArray(data.errors) &&
        data.errors.some(
          (e) =>
            e?.errorCode === "FFMPEG_NOT_FOUND" ||
            (typeof e?.message === "string" && e.message.toLowerCase().includes("ffmpeg"))
        );
      if (!data.success && hasFfmpegNotFound) {
        setFfmpegAlert(true);
      }
    } catch (error) {
      console.error("Video post hatası:", error);
      setErrors([{ step: "Hata", message: error.message || "Bilinmeyen hata" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Studio" subtitle="AI destekli içerik üretim paneli." />

      {/* Türkçe yorum: Ana form - konu, not, format, hedef. */}
      <Card className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Konu"
            placeholder="Örn: Hipertansiyon kontrolü"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={loading}
          />
          <Textarea
            label="Not / Branş"
            placeholder="Kısa not veya branş bilgisi"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Select
            label="Format"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            disabled={loading}
            options={[
              { value: "9:16", label: "Dikey (9:16) - Instagram Story/Reels" },
              { value: "16:9", label: "Yatay (16:9) - YouTube/Post" },
            ]}
          />
          <Select
            label="Hedef (Opsiyonel)"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            disabled={loading}
            options={[
              { value: "bilgilendirme", label: "Bilgilendirme" },
              { value: "güven", label: "Güven oluşturma" },
              { value: "hasta-kazanımı", label: "Hasta kazanımı" },
            ]}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Select
            label="Ses Seçeneği (Video Post için)"
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            disabled={loading}
            options={[
              { value: "alloy", label: "Alloy (Varsayılan - Dengeli)" },
              { value: "echo", label: "Echo (Erkek, Derin)" },
              { value: "fable", label: "Fable (İngiliz, Hikayeci)" },
              { value: "onyx", label: "Onyx (Erkek, Güçlü)" },
              { value: "nova", label: "Nova (Kadın, Genç)" },
              { value: "shimmer", label: "Shimmer (Kadın, Yumuşak)" },
            ]}
          />
          <div className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              id="includeDisclaimerInAudio"
              checked={includeDisclaimerInAudio}
              onChange={(e) => setIncludeDisclaimerInAudio(e.target.checked)}
              disabled={loading}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="includeDisclaimerInAudio" className="text-sm text-slate-700">
              Disclaimer seslendirilsin (Video Post)
            </label>
          </div>
        </div>
      </Card>

      {/* Türkçe yorum: Ana aksiyon butonları. */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Görsel Post Hazırla</h3>
            <p className="text-sm text-slate-600">Metin + görsel içeren hazır post</p>
          </div>
          <Button onClick={handleCreateImagePost} disabled={loading} className="w-full">
            {loading ? "Üretiliyor..." : "Görsel Post Hazırla"}
          </Button>
        </Card>

        <Card className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Video Post Hazırla</h3>
            <p className="text-sm text-slate-600">Metin + görsel + ses + video içeren hazır post</p>
          </div>
          {/* Türkçe yorum: Buton çevreye göre kilitlenmez; sadece loading veya validasyon eksikse disable olur. */}
          <Button onClick={handleCreateVideoPost} disabled={loading || !topic.trim()} className="w-full">
            {loading ? "Üretiliyor..." : "Video Post Hazırla"}
          </Button>
        </Card>
      </div>

      {/* Türkçe yorum: FFmpeg uyarısı (tıklama sonrası). */}
      {ffmpegAlert && (
        <Card className="border-red-200 bg-red-50">
          <h3 className="font-semibold text-red-900">Video üretimi başarısız</h3>
          <p className="mt-2 text-sm text-red-700">
            Bu cihazda FFmpeg bulunamadı. Video üretimi için FFmpeg kurulmalıdır.
          </p>
          <p className="mt-2 text-sm text-red-700">
            <a
              href="https://ffmpeg.org/download.html"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Kurulum rehberi
            </a>
          </p>
          {lastDebugId && <p className="mt-2 text-xs text-red-700">debugId: {lastDebugId}</p>}
        </Card>
      )}

      {/* Türkçe yorum: Progress gösterimi. */}
      {progress.length > 0 && (
        <Card className="space-y-2">
          <h3 className="font-semibold text-slate-900">İlerleme</h3>
          <div className="space-y-1">
            {progress.map((p, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                {p.status === "loading" && <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />}
                {p.status === "success" && <span className="text-green-600">✓</span>}
                {p.status === "error" && <span className="text-red-600">✗</span>}
                <span className={p.status === "error" ? "text-red-600" : "text-slate-700"}>{p.step}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Türkçe yorum: Hata mesajları. */}
      {errors.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <h3 className="font-semibold text-red-900">Hatalar</h3>
          <ul className="mt-2 space-y-1 text-sm text-red-700">
            {errors.map((err, idx) => (
              <li key={idx}>
                <strong>{err.step}:</strong> {err.message}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Türkçe yorum: Sonuç paneli. */}
      {result && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Sonuç</h3>
            {usedMock && (
              <span className="text-xs rounded-full bg-amber-100 px-2 py-1 text-amber-800">Mock çıktı kullanıldı</span>
            )}
          </div>

          {/* Görsel Post sonucu */}
          {result.type === "imagePost" && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-slate-900">Post Metni</h4>
                <div className="mt-2 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                  {result.body?.text?.hook && <p className="font-medium mb-2">{result.body.text.hook}</p>}
                  {result.body?.text?.bullets?.length > 0 && (
                    <ul className="list-disc list-inside space-y-1 mb-2">
                      {result.body.text.bullets.map((bullet, idx) => (
                        <li key={idx}>{bullet}</li>
                      ))}
                    </ul>
                  )}
                  {result.body?.text?.cta && <p className="font-medium mb-2">{result.body.text.cta}</p>}
                  {result.body?.text?.disclaimer && <p className="text-xs text-slate-500 italic">{result.body.text.disclaimer}</p>}
                </div>
              </div>
              {result.body?.image?.imageUrl ? (
                <div>
                  <h4 className="font-medium text-slate-900">Görsel</h4>
                  <img
                    src={result.body.image.imageUrl}
                    alt={result.title}
                    className="mt-2 w-full rounded-md border border-slate-200"
                  />
                </div>
              ) : (
                <div className="rounded-md border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-600">
                  Görsel üretilemedi (API key eksik veya hata oluştu)
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => window.location.href = `/dashboard/assets/${result.id}`}>
                  Detay Görüntüle
                </Button>
                <Button variant="secondary" onClick={handleCreateImagePost} disabled={loading}>
                  Tekrar Üret
                </Button>
              </div>
            </div>
          )}

          {/* Video Post sonucu - parçalı çıktı */}
          {result.type === "videoParts" && (
            <div className="space-y-6">
              {/* Metin */}
              <div>
                <h4 className="font-medium text-slate-900">Metin</h4>
                <div className="mt-2 rounded-md border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-800">
                  {result.body?.text?.hook && <p className="mb-2 font-semibold">{result.body.text.hook}</p>}
                  {Array.isArray(result.body?.text?.bullets) && result.body.text.bullets.length > 0 && (
                    <ul className="mb-2 list-disc pl-5">
                      {result.body.text.bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  )}
                  {result.body?.text?.text && <p className="whitespace-pre-wrap">{result.body.text.text}</p>}
                  {result.body?.text?.cta && <p className="mt-2 italic text-slate-700">{result.body.text.cta}</p>}
                  {result.body?.text?.disclaimer && (
                    <p className="mt-2 text-xs text-slate-500">{result.body.text.disclaimer}</p>
                  )}
                </div>
              </div>

              {/* Görseller */}
              <div>
                <h4 className="font-medium text-slate-900">Görseller ({result.body?.format})</h4>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(result.body?.images || []).map((img, i) => (
                    <div key={i} className="rounded-md border border-slate-200 bg-white p-2">
                      {img?.url ? (
                        <img src={img.url} alt={`Sahne ${img.sceneIndex || i + 1}`} className="h-48 w-full rounded object-cover" />
                      ) : (
                        <div className="flex h-48 w-full items-center justify-center rounded bg-slate-50 text-xs text-slate-500">
                          Görsel yok
                        </div>
                      )}
                      {img?.prompt && (
                        <p className="mt-2 line-clamp-3 text-xs text-slate-500">Prompt: {img.prompt}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Ses */}
              <div>
                <h4 className="font-medium text-slate-900">Ses</h4>
                <div className="mt-2 rounded-md border border-slate-200 bg-white p-3">
                  {result.body?.audio?.audioUrl ? (
                    <audio src={result.body.audio.audioUrl} controls className="w-full" />
                  ) : (
                    <div className="rounded border border-dashed border-slate-300 p-3 text-sm text-slate-600">
                      Ses dosyası üretilmedi.
                    </div>
                  )}
                  {result.body?.audio?.transcript && (
                    <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{result.body.audio.transcript}</p>
                  )}
                </div>
              </div>

              {/* Altyazılar */}
              <div>
                <h4 className="font-medium text-slate-900">Altyazılar</h4>
                <div className="mt-2 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
                  {(result.body?.captions || []).length === 0 ? (
                    <p className="text-slate-500">Altyazı bulunamadı.</p>
                  ) : (
                    <ol className="list-decimal space-y-1 pl-5">
                      {result.body.captions.map((c, i) => (
                        <li key={i}>
                          <span className="text-xs text-slate-500 mr-2">
                            [{c.start}s → {c.end}s]
                          </span>
                          {c.text}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => window.location.href = `/dashboard/assets/${result.id}`}>
                  Detay Görüntüle
                </Button>
                <Button variant="secondary" onClick={handleCreateVideoPost} disabled={loading}>
                  Tekrar Üret
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Türkçe yorum: Geliştirici Modu (collapsible). */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Geliştirici Modu</h3>
          <Button variant="secondary" onClick={() => setDevMode(!devMode)}>
            {devMode ? "Gizle" : "Göster"}
          </Button>
        </div>
        {devMode && (
          <div className="space-y-2 text-sm text-slate-600">
            <p>Eski tekil ses/görsel önizlemeleri burada tutulabilir (kullanıcıya gösterilmez).</p>
            <p>Video render zorunludur; FFmpeg yoksa render yapılamaz.</p>
            <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-700">
              <p>
                <strong>renderMode:</strong> {ffmpegInfo.mode ?? "unknown"}
              </p>
              <p>
                <strong>ffmpeg:</strong> {ffmpegInfo.ready === null ? "unknown" : ffmpegInfo.ready ? "true" : "false"}
              </p>
              {lastDebugId && (
                <p>
                  <strong>lastDebugId:</strong> {lastDebugId}
                </p>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
