"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Card from "../../../../components/Card";
import PageHeader from "../../../../components/PageHeader";
import Button from "../../../../components/Button";
import { useAssetStore } from "../../../../features/assets/store";

// Türkçe yorum: Detay sayfası; asset bulunmazsa sade mesaj verir, crash etmez. Görsel/audio/video preview içerir.
export default function AssetDetailPage() {
  const params = useParams();
  const { assets, upsertAsset } = useAssetStore();
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showDevMode, setShowDevMode] = useState(false);

  useEffect(() => {
    const load = async () => {
      setMessage("");
      try {
        const res = await fetch(`/api/assets/${params.id}`);
        if (res.ok) {
          const data = await res.json();
          setAsset(data);
          upsertAsset(data);
        } else {
          setMessage("İçerik bulunamadı");
        }
      } catch (_e) {
        setMessage("Bağlantı hatası");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [params.id, upsertAsset]);

  const handleVariant = async () => {
    setMessage("");
    try {
      const res = await fetch(`/api/assets/${params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: { variantNote: "Mock varyasyon" } }),
      });
      if (res.ok) {
        const data = await res.json();
        setAsset(data);
        upsertAsset(data);
        setMessage("Varyasyon üretildi (mock).");
      } else {
        setMessage("Varyasyon oluşturulamadı");
      }
    } catch (_e) {
      setMessage("Bağlantı hatası");
    }
  };

  if (loading) return <p className="text-sm text-slate-600">Yükleniyor...</p>;
  if (!asset) return <p className="text-sm text-red-600">İçerik bulunamadı.</p>;

  // Türkçe yorum: İçerik önizleme metni her zaman string olmalı; obje ise uygun alan çıkarılır ya da JSON.stringify yapılır.
  let contentPreview = "";
  try {
    if (typeof asset.body?.text === "string") {
      contentPreview = asset.body.text;
    } else if (asset.type === "videoParts" && typeof asset.body?.text === "object") {
      contentPreview = asset.body.text.hook || asset.body.text.text || "";
    } else if (typeof asset.body?.script === "string") {
      contentPreview = asset.body.script;
    } else if (typeof asset.body?.transcript === "string") {
      contentPreview = asset.body.transcript;
    } else {
      contentPreview = JSON.stringify(asset.body, null, 2);
    }
  } catch (_e) {
    contentPreview = "";
  }
  const imageUrl = asset.body?.imageUrl;
  const audioUrl = asset.body?.audioUrl;
  const videoUrl = asset.body?.videoUrl;

  return (
    <div className="space-y-6">
      <PageHeader
        title={asset.title}
        subtitle={`Tür: ${asset.type} | Durum: ${asset.status}`}
        actions={<Button onClick={handleVariant}>Varyasyon üret</Button>}
      />
      {message && <p className="text-sm text-blue-700">{message}</p>}

      {/* Türkçe yorum: videoParts türü için parçalı gösterim ve indirme. */}
      {asset.type === "videoParts" && (
        <Card className="space-y-6">
          <h3 className="font-semibold text-slate-900">Video Parçaları</h3>

          {/* Metin */}
          <div>
            <h4 className="font-medium text-slate-900">Metin</h4>
            <div className="mt-2 rounded-md border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-800">
              {asset.body?.text?.hook && <p className="mb-2 font-semibold">{asset.body.text.hook}</p>}
              {Array.isArray(asset.body?.text?.bullets) && asset.body.text.bullets.length > 0 && (
                <ul className="mb-2 list-disc pl-5">
                  {asset.body.text.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
              {asset.body?.text?.text && <p className="whitespace-pre-wrap">{asset.body.text.text}</p>}
              {asset.body?.text?.cta && <p className="mt-2 italic text-slate-700">{asset.body.text.cta}</p>}
              {asset.body?.text?.disclaimer && (
                <p className="mt-2 text-xs text-slate-500">{asset.body.text.disclaimer}</p>
              )}
            </div>
          </div>

          {/* Görseller */}
          <div>
            <h4 className="font-medium text-slate-900">Görseller ({asset.body?.format})</h4>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(asset.body?.images || []).map((img, i) => (
                <div key={i} className="rounded-md border border-slate-200 bg-white p-2">
                  {img?.url ? (
                    <img src={img.url} alt={`Sahne ${img.sceneIndex || i + 1}`} className="h-48 w-full rounded object-cover" />
                  ) : (
                    <div className="flex h-48 w-full items-center justify-center rounded bg-slate-50 text-xs text-slate-500">
                      Görsel yok
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-slate-500">Sahne {img.sceneIndex || i + 1}</span>
                    {img?.url && (
                      <a href={img.url} download className="text-xs text-slate-700 underline">
                        İndir
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ses */}
          <div>
            <h4 className="font-medium text-slate-900">Ses</h4>
            <div className="mt-2 rounded-md border border-slate-200 bg-white p-3">
              {asset.body?.audio?.audioUrl ? (
                <audio src={asset.body.audio.audioUrl} controls className="w-full" />
              ) : (
                <div className="rounded border border-dashed border-slate-300 p-3 text-sm text-slate-600">
                  Ses dosyası üretilmedi.
                </div>
              )}
              {asset.body?.audio?.audioUrl && (
                <div className="mt-2">
                  <a href={asset.body.audio.audioUrl} download className="text-xs text-slate-700 underline">
                    İndir (MP3)
                  </a>
                </div>
              )}
              {asset.body?.audio?.transcript && (
                <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{asset.body.audio.transcript}</p>
              )}
            </div>
          </div>

          {/* Altyazılar */}
          <div>
            <h4 className="font-medium text-slate-900">Altyazılar</h4>
            <div className="mt-2 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
              {(asset.body?.captions || []).length === 0 ? (
                <p className="text-slate-500">Altyazı bulunamadı.</p>
              ) : (
                <ol className="list-decimal space-y-1 pl-5">
                  {asset.body.captions.map((c, i) => (
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
        </Card>
      )}

      {/* Türkçe yorum: Görsel preview; imageUrl varsa gösterilir, yoksa placeholder. */}
      {(asset.type === "image916" || asset.type === "image169") && (
        <Card className="space-y-3">
          <h3 className="font-semibold text-slate-900">Görsel</h3>
          {imageUrl && (imageUrl.startsWith("data:") || imageUrl.startsWith("http")) ? (
            <img src={imageUrl} alt={asset.title} className="w-full rounded-md border border-slate-200" />
          ) : imageUrl ? (
            <img src={`/api/media/${asset.id}`} alt={asset.title} className="w-full rounded-md border border-slate-200" />
          ) : (
            <div className="flex flex-col items-center justify-center rounded-md border-2 border-dashed border-slate-300 bg-slate-50 p-8">
              <p className="text-sm font-medium text-slate-600">Görsel üretilemedi</p>
              <p className="mt-2 text-xs text-slate-500">API key eksik veya üretim başarısız oldu</p>
              {asset.body?.usedPrompt && (
                <div className="mt-4 w-full rounded-md bg-white p-3 text-left">
                  <p className="text-xs font-medium text-slate-700">Kullanılan Prompt:</p>
                  <p className="mt-1 text-xs text-slate-600">{asset.body.usedPrompt}</p>
                </div>
              )}
            </div>
          )}
          {asset.body?.usedPrompt && imageUrl && (
            <p className="text-xs text-slate-500">Prompt: {asset.body.usedPrompt}</p>
          )}
        </Card>
      )}

      {/* Türkçe yorum: Audio player; audioUrl varsa gösterilir. */}
      {audioUrl && (
        <Card className="space-y-3">
          <h3 className="font-semibold text-slate-900">Ses</h3>
          {audioUrl.startsWith("data:") || audioUrl.startsWith("http") ? (
            <audio controls className="w-full">
              <source src={audioUrl} type="audio/mpeg" />
              Tarayıcınız audio elementini desteklemiyor.
            </audio>
          ) : (
            <audio controls className="w-full">
              <source src={`/api/media/${asset.id}`} type="audio/mpeg" />
              Tarayıcınız audio elementini desteklemiyor.
            </audio>
          )}
          {asset.body?.transcript && (
            <div className="rounded-md bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-700">Transkript:</p>
              <p className="mt-1 text-sm text-slate-800">{asset.body.transcript}</p>
            </div>
          )}
        </Card>
      )}

      {/* Türkçe yorum: Video player; videoUrl varsa gösterilir. */}
      {videoUrl && (
        <Card className="space-y-3">
          <h3 className="font-semibold text-slate-900">Video</h3>
          {videoUrl.startsWith("data:") || videoUrl.startsWith("http") ? (
            <video controls className="w-full rounded-md border border-slate-200">
              <source src={videoUrl} type="video/mp4" />
              Tarayıcınız video elementini desteklemiyor.
            </video>
          ) : (
            <video controls className="w-full rounded-md border border-slate-200">
              <source src={`/api/media/${asset.id}`} type="video/mp4" />
              Tarayıcınız video elementini desteklemiyor.
            </video>
          )}
          {asset.body?.timeline && (
            <div className="rounded-md bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-700">Timeline:</p>
              <ul className="mt-1 space-y-1 text-sm text-slate-800">
                {asset.body.timeline.map((scene, idx) => (
                  <li key={idx}>
                    {scene.scene}: {scene.caption} ({scene.duration}s)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      <Card className="space-y-3">
        <h3 className="font-semibold text-slate-900">İçerik</h3>
        <pre className="whitespace-pre-wrap break-words rounded-md bg-slate-50 p-3 text-sm text-slate-800">
          {contentPreview}
        </pre>
      </Card>

      <Card className="space-y-2">
        <h3 className="font-semibold text-slate-900">Varyasyonlar</h3>
        {asset.variants?.length === 0 && <p className="text-sm text-slate-600">Henüz varyasyon yok.</p>}
        {asset.variants?.map((variant) => (
          <div key={variant.id} className="rounded-md border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">v{variant.version}</p>
            <pre className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-800">
              {JSON.stringify(variant.payload, null, 2)}
            </pre>
          </div>
        ))}
      </Card>

      <Card className="space-y-2">
        <h3 className="font-semibold text-slate-900">Güvenlik Kontrolleri</h3>
        {asset.safetyChecks?.length === 0 && <p className="text-sm text-slate-600">Kayıtlı kontrol yok.</p>}
        {asset.safetyChecks?.map((check) => (
          <div
            key={check.id}
            className={`rounded-md border p-3 ${
              check.verdict === "warn" ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"
            }`}
          >
            <p className="text-xs font-semibold uppercase text-slate-700">{check.verdict}</p>
            <p className="text-sm text-slate-800">{(check.reasons || []).join(", ") || "Sebep belirtilmedi"}</p>
          </div>
        ))}
      </Card>

      {/* Türkçe yorum: Geliştirici modu; payload JSON'u collapsible gösterilir. */}
      <Card className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Geliştirici Modu</h3>
          <Button variant="ghost" onClick={() => setShowDevMode(!showDevMode)}>
            {showDevMode ? "Gizle" : "Göster"}
          </Button>
        </div>
        {showDevMode && (
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-900 p-3 text-xs text-slate-100">
            {JSON.stringify(asset, null, 2)}
          </pre>
        )}
      </Card>
    </div>
  );
}


