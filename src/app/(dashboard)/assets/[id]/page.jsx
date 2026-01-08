"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Card from "../../../../components/Card";
import PageHeader from "../../../../components/PageHeader";
import Button from "../../../../components/Button";
import Textarea from "../../../../components/Textarea";
import Modal from "../../../../components/Modal";
import LoadingSpinner from "../../../../components/LoadingSpinner";
import ImageViewerModal from "../../../../components/ImageViewerModal";
import { useAssetStore } from "../../../../features/assets/store";

// Türkçe yorum: Detay sayfası; asset bulunmazsa sade mesaj verir, crash etmez. Görsel/audio/video preview içerir.
export default function AssetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { assets, upsertAsset } = useAssetStore();
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showDevMode, setShowDevMode] = useState(false);
  const [reviseLoading, setReviseLoading] = useState(false);
  const [showReviseModal, setShowReviseModal] = useState(false);
  const [reviseRequest, setReviseRequest] = useState("");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerSrc, setViewerSrc] = useState(null);
  const [viewerAlt, setViewerAlt] = useState("");

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

  // Alternatif görsel üret (AI otomatik alternatif üretir)
  const handleGenerateAlternative = async () => {
    if (!asset || (asset.type !== "image916" && asset.type !== "image169")) return;
    
    setReviseLoading(true);
    setMessage("");
    
    try {
      const res = await fetch("/api/studio/image-revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: asset.id,
          revisionType: "alternative", // Alternatif üret
          format: asset.body?.metadata?.format || "9:16",
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        setMessage(errorData.message || errorData.error || "Alternatif görsel üretilemedi");
        return;
      }

      const data = await res.json();
      if (data.success && data.asset) {
        // Yeni asset'e yönlendir
        router.push(`/assets/${data.asset.id}`);
      } else {
        setMessage("Alternatif görsel üretilemedi");
      }
    } catch (error) {
      console.error("Alternatif görsel hatası:", error);
      setMessage("Bağlantı hatası");
    } finally {
      setReviseLoading(false);
    }
  };

  // Revize et (kullanıcı yorumu ile)
  const handleRevise = async () => {
    if (!asset || (asset.type !== "image916" && asset.type !== "image169")) return;
    if (!reviseRequest.trim()) {
      setMessage("Lütfen revizyon talebinizi yazın");
      return;
    }
    
    setReviseLoading(true);
    setMessage("");
    
    try {
      const res = await fetch("/api/studio/image-revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: asset.id,
          revisionType: "revise", // Revize et
          userRequest: reviseRequest.trim(),
          format: asset.body?.metadata?.format || "9:16",
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        setMessage(errorData.message || errorData.error || "Revizyon başarısız");
        return;
      }

      const data = await res.json();
      if (data.success && data.asset) {
        setShowReviseModal(false);
        setReviseRequest("");
        // Yeni asset'e yönlendir
        router.push(`/assets/${data.asset.id}`);
      } else {
        setMessage("Revizyon başarısız");
      }
    } catch (error) {
      console.error("Revizyon hatası:", error);
      setMessage("Bağlantı hatası");
    } finally {
      setReviseLoading(false);
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

      {/* videoParts türü için parçalı gösterim */}
      {asset.type === "videoParts" && (
        <Card className="space-y-6">
          {/* 1. Üretilen Görseller */}
          <div>
            <h4 className="font-medium text-slate-900 mb-2">Üretilen Görseller ({asset.body?.format})</h4>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(asset.body?.images || []).map((img, i) => (
                <div key={i} className="rounded-md border border-slate-200 bg-white p-2">
                  {img?.url ? (
                    <div>
                      <img
                        src={img.url}
                        alt={`Sahne ${img.sceneIndex || i + 1}`}
                        className="h-48 w-full rounded object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => {
                          const imgUrl = img.url.startsWith("http") || img.url.startsWith("data:") ? img.url : `/api/media/${asset.id}?image=${i}`;
                          setViewerSrc(imgUrl);
                          setViewerAlt(`Sahne ${img.sceneIndex || i + 1}`);
                          setViewerOpen(true);
                        }}
                      />
                      {img?.prompt && (
                        <p className="mt-2 line-clamp-2 text-xs text-slate-500">Prompt: {img.prompt}</p>
                      )}
                    </div>
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

          {/* 2. Görseli Üreten Prompt */}
          {asset.body?.images?.[0]?.prompt && (
            <div>
              <h4 className="font-medium text-slate-900 mb-2">Görseli Üreten Prompt</h4>
              <div className="mt-2 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                <p className="whitespace-pre-wrap">{asset.body.images[0].prompt}</p>
              </div>
            </div>
          )}

          {/* 3. Konu Başlık Yazısı */}
          <div>
            <h4 className="font-medium text-slate-900 mb-2">Konu Başlık</h4>
            <p className="mt-1 text-sm text-slate-700 font-medium">{asset.title}</p>
          </div>

          {/* 4. Konu İçerik Yazısı */}
          {asset.body?.text?.text && (
            <div>
              <h4 className="font-medium text-slate-900 mb-2">Konu İçerik Açıklaması</h4>
              <div className="mt-2 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                <p className="whitespace-pre-wrap">{asset.body.text.text}</p>
              </div>
            </div>
          )}

          {/* 5. Konu ile Alakalı Etiketler */}
          {((asset.body?.tags && asset.body.tags.length > 0) || (asset.cdnaSnapshot?.styleGuide?.visualTags && asset.cdnaSnapshot.styleGuide.visualTags.length > 0)) && (
            <div>
              <h4 className="font-medium text-slate-900 mb-2">Etiketler</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {(asset.body?.tags || asset.cdnaSnapshot?.styleGuide?.visualTags || []).map((t, i) => (
                  <span key={i} className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">#{t.replace(/^#/, "")}</span>
                ))}
              </div>
            </div>
          )}

          {/* 6. Final Son Paylaşıma Hazır Metin */}
          <div>
            <h4 className="font-medium text-slate-900 mb-2">Paylaşıma Hazır Metin</h4>
            <div className="mt-2 rounded-md bg-blue-50 border border-blue-200 p-4 text-sm text-slate-800">
              {asset.body?.text?.hook && <p className="font-semibold mb-2 text-blue-900">{asset.body.text.hook}</p>}
              {Array.isArray(asset.body?.text?.bullets) && asset.body.text.bullets.length > 0 && (
                <ul className="mb-2 list-disc pl-5">
                  {asset.body.text.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
              {asset.body?.text?.text && <p className="whitespace-pre-wrap mb-2">{asset.body.text.text}</p>}
              {asset.body?.text?.cta && <p className="font-semibold mt-2 text-blue-900">{asset.body.text.cta}</p>}
              {asset.body?.text?.disclaimer && (
                <p className="text-xs text-slate-500 italic mt-2">{asset.body.text.disclaimer}</p>
              )}
            </div>
          </div>

          {/* 7. Resmi İndir Butonu */}
          {asset.body?.images && asset.body.images.length > 0 && asset.body.images[0]?.url && (
            <div className="flex gap-2 flex-wrap">
              <a href={asset.body.images[0].url} download>
                <Button variant="secondary">Görseli İndir</Button>
              </a>
            </div>
          )}

          {/* 8. Ses, Ses Dinleme Player ve Ses İndir Butonu */}
          <div>
            <h4 className="font-medium text-slate-900 mb-2">Ses</h4>
            <div className="mt-2 rounded-md border border-slate-200 bg-white p-3">
              {asset.body?.audio?.audioUrl ? (
                <div className="space-y-3">
                  <audio src={asset.body.audio.audioUrl} controls className="w-full" />
                  <div>
                    <a href={asset.body.audio.audioUrl} download>
                      <Button variant="secondary">Sesi İndir</Button>
                    </a>
                  </div>
                  {asset.body?.audio?.transcript && (
                    <div className="mt-3 rounded-md bg-slate-50 p-3">
                      <p className="text-xs font-medium text-slate-700 mb-1">Transkript:</p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{asset.body.audio.transcript}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded border border-dashed border-slate-300 p-3 text-sm text-slate-600">
                  Ses dosyası üretilmedi.
                </div>
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

      {/* imagePost veya image916/image169 için görsel gösterimi */}
      {(asset.type === "imagePost" || asset.type === "image916" || asset.type === "image169") && (
        <Card className="space-y-6">
          {/* 1. Üretilen Görsel */}
          <div>
            <h4 className="font-medium text-slate-900 mb-2">Üretilen Görsel</h4>
            {imageUrl ? (
              <div className="mt-2">
                <img
                  src={imageUrl.startsWith("data:") || imageUrl.startsWith("http") ? imageUrl : `/api/media/${asset.id}`}
                  alt={asset.title}
                  className="w-full rounded-md border border-slate-200 cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => {
                    const imgUrl = imageUrl.startsWith("data:") || imageUrl.startsWith("http") ? imageUrl : `/api/media/${asset.id}`;
                    setViewerSrc(imgUrl);
                    setViewerAlt(asset.title || "");
                    setViewerOpen(true);
                  }}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-md border-2 border-dashed border-slate-300 bg-slate-50 p-8">
                <p className="text-sm font-medium text-slate-600">Görsel üretilemedi</p>
                <p className="mt-2 text-xs text-slate-500">API key eksik veya üretim başarısız oldu</p>
              </div>
            )}
          </div>

          {/* 2. Görseli Üreten Prompt */}
          {(asset.body?.image?.usedPrompt || asset.body?.image?.prompt || asset.body?.usedPrompt) && (
            <div>
              <h4 className="font-medium text-slate-900 mb-2">Görseli Üreten Prompt</h4>
              <div className="mt-2 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                <p className="whitespace-pre-wrap">{asset.body?.image?.usedPrompt || asset.body?.image?.prompt || asset.body?.usedPrompt || "(Prompt yok)"}</p>
              </div>
            </div>
          )}

          {/* 3. Konu Başlık Yazısı */}
          <div>
            <h4 className="font-medium text-slate-900 mb-2">Konu Başlık</h4>
            <p className="mt-1 text-sm text-slate-700 font-medium">{asset.title}</p>
          </div>

          {/* 4. Konu İçerik Yazısı */}
          {asset.body?.text?.text && typeof asset.body.text.text === "string" && (
            <div>
              <h4 className="font-medium text-slate-900 mb-2">Konu İçerik Açıklaması</h4>
              <div className="mt-2 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                <p className="whitespace-pre-wrap">{asset.body.text.text}</p>
              </div>
            </div>
          )}

          {/* 5. Konu ile Alakalı Etiketler */}
          {((asset.body?.tags && asset.body.tags.length > 0) || (asset.cdnaSnapshot?.styleGuide?.visualTags && asset.cdnaSnapshot.styleGuide.visualTags.length > 0)) && (
            <div>
              <h4 className="font-medium text-slate-900 mb-2">Etiketler</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {(asset.body?.tags || asset.cdnaSnapshot?.styleGuide?.visualTags || []).map((t, i) => (
                  <span key={i} className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">#{t.replace(/^#/, "")}</span>
                ))}
              </div>
            </div>
          )}

          {/* 6. Final Son Paylaşıma Hazır Metin */}
          {asset.body?.text && typeof asset.body.text === "object" && (
            <div>
              <h4 className="font-medium text-slate-900 mb-2">Paylaşıma Hazır Metin</h4>
              <div className="mt-2 rounded-md bg-blue-50 border border-blue-200 p-4 text-sm text-slate-800">
                {asset.body.text.hook && <p className="font-semibold mb-2 text-blue-900">{asset.body.text.hook}</p>}
                {Array.isArray(asset.body.text.bullets) && asset.body.text.bullets.length > 0 && (
                  <ul className="list-disc list-inside space-y-1 mb-2">
                    {asset.body.text.bullets.map((bullet, idx) => (
                      <li key={idx}>{bullet}</li>
                    ))}
                  </ul>
                )}
                {asset.body.text.text && <p className="whitespace-pre-wrap mb-2">{asset.body.text.text}</p>}
                {asset.body.text.cta && <p className="font-semibold mt-2 text-blue-900">{asset.body.text.cta}</p>}
                {asset.body.text.disclaimer && <p className="text-xs text-slate-500 italic mt-2">{asset.body.text.disclaimer}</p>}
              </div>
            </div>
          )}

          {/* 7. Resmi İndir Butonu */}
          {imageUrl && (
            <div className="flex gap-2 flex-wrap">
              <a href={imageUrl.startsWith("data:") || imageUrl.startsWith("http") ? imageUrl : `/api/media/${asset.id}`} download>
                <Button variant="secondary">Görseli İndir</Button>
              </a>
              {(asset.type === "image916" || asset.type === "image169") && (
                <>
                  <Button
                    variant="secondary"
                    onClick={handleGenerateAlternative}
                    disabled={reviseLoading}
                  >
                    {reviseLoading ? "Üretiliyor..." : "Alternatif Üret"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowReviseModal(true)}
                    disabled={reviseLoading}
                  >
                    Revize Et
                  </Button>
                </>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Revize Modal */}
      <Modal
        open={showReviseModal}
        onClose={() => {
          setShowReviseModal(false);
          setReviseRequest("");
        }}
        title="Görseli Revize Et"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Resimde revize etmek istediğiniz ya da yeni içeriğin nasıl olmasını istiyorsanız onu yazın.
          </p>
          <Textarea
            label="Revizyon Talebi"
            placeholder="Örn: 'Daha parlak renkler kullan', 'Arka planı değiştir', 'Yazıları daha büyük yap'..."
            value={reviseRequest}
            onChange={(e) => setReviseRequest(e.target.value)}
            rows={4}
          />
        </div>
        <div className="mt-6 flex gap-2 justify-end">
          <Button
            variant="secondary"
            onClick={() => {
              setShowReviseModal(false);
              setReviseRequest("");
            }}
            disabled={reviseLoading}
          >
            İptal
          </Button>
          <Button
            onClick={handleRevise}
            disabled={reviseLoading || !reviseRequest.trim()}
          >
            {reviseLoading ? (
              <>
                <LoadingSpinner size="sm" />
                <span className="ml-2">Revize Ediliyor...</span>
              </>
            ) : (
              "Revize Et"
            )}
          </Button>
        </div>
      </Modal>

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

      {/* Full-screen Image Viewer Modal */}
      <ImageViewerModal open={viewerOpen} src={viewerSrc} alt={viewerAlt} onClose={() => setViewerOpen(false)} />
    </div>
  );
}


