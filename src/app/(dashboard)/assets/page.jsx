"use client";

import React, { useEffect, useState } from "react";
import Card from "../../../components/Card";
import PageHeader from "../../../components/PageHeader";
import Button from "../../../components/Button";
import Select from "../../../components/Select";
import { useAssetStore } from "../../../features/assets/store";

// Türkçe yorum: Asset listesi; filtreleme ile type ve status kontrolü. API başarısız olursa store'daki son veriyi gösterir.
export default function AssetsPage() {
  const { assets, setAssets } = useAssetStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    const load = async () => {
      setError("");
      try {
        const params = new URLSearchParams();
        if (typeFilter) params.append("type", typeFilter);
        if (statusFilter) params.append("status", statusFilter);
        const url = `/api/assets${params.toString() ? `?${params.toString()}` : ""}`;

        const res = await fetch(url);
        if (!res.ok) {
          setError("Liste alınamadı");
          return;
        }
        const data = await res.json();
        setAssets(data);
      } catch (_e) {
        setError("Bağlantı hatası");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [setAssets, typeFilter, statusFilter]);

  const filteredAssets = assets.filter((asset) => {
    if (typeFilter && asset.type !== typeFilter) return false;
    if (statusFilter && asset.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="İçerikler" subtitle="Üretilen tüm assetler." />

      <Card className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Select
            label="Tür Filtresi"
            options={[
              { value: "", label: "Tümü" },
              { value: "text", label: "Metin" },
              { value: "imagePost", label: "Görsel Post" },
              { value: "image916", label: "Görsel (9:16)" },
              { value: "image169", label: "Görsel (16:9)" },
              { value: "audio", label: "Ses" },
              { value: "video", label: "Video (MP4)" },
              { value: "videoParts", label: "Video Parçaları" },
            ]}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          />
          <Select
            label="Durum Filtresi"
            options={[
              { value: "", label: "Tümü" },
              { value: "draft", label: "Taslak" },
              { value: "ready", label: "Hazır" },
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>
      </Card>

      {loading && <p className="text-sm text-slate-600">Yükleniyor...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && filteredAssets.length === 0 && <p className="text-sm text-slate-600">Henüz içerik yok.</p>}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredAssets.map((asset) => {
          // Türkçe yorum: Önizleme metni; obje ise güvenli şekilde string'e dönüştürülür.
          let preview = "";
          const body = asset.body || {};
          if (typeof body.text === "string") {
            preview = body.text;
          } else if (asset.type === "imagePost" && typeof body.text === "object") {
            // imagePost için text objesi içindeki metin
            preview = body.text.text || body.text.hook || "";
          } else if (asset.type === "videoParts" && typeof body.text === "object") {
            preview = body.text.hook || body.text.text || "";
          } else if (typeof body.script === "string") {
            preview = body.script;
          } else if (typeof body.transcript === "string") {
            preview = body.transcript;
          } else {
            try {
              // Türkçe yorum: data: URL'leri (base64) önizlemede uzun yazı gibi görünmesin diye kısaltıyoruz.
              preview = JSON.stringify(body, (k, v) => {
                if (typeof v === "string" && v.startsWith("data:")) return `[dataUrl len=${v.length}]`;
                return v;
              });
            } catch (_e) {
              preview = "";
            }
          }
          if (preview.length > 200) preview = preview.slice(0, 200) + "…";
          
          // Eğer preview yoksa, metadata'dan topic göster
          if (!preview && body.metadata?.topic) {
            preview = `Konu: ${body.metadata.topic}`;
          }

          // Türkçe yorum: Kart görseli (varsa) - image, imagePost veya videoParts ilk sahne.
          const thumbUrl =
            body.imageUrl ||
            (body.image && body.image.imageUrl) ||
            (asset.type === "imagePost" && body.image?.imageUrl) ||
            (asset.type === "image916" && body.imageUrl) ||
            (asset.type === "image169" && body.imageUrl) ||
            (asset.type === "videoParts" && Array.isArray(body.images) && body.images[0]?.url) ||
            null;

          return (
            <Card key={asset.id} className="space-y-3">
              {thumbUrl && (
                <img
                  src={thumbUrl}
                  alt={asset.title}
                  className="h-40 w-full rounded-md border border-slate-200 object-cover"
                />
              )}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-blue-600">{asset.type}</p>
                  <h3 className="font-semibold text-slate-900">{asset.title}</h3>
                </div>
                <span className="text-xs text-slate-500">{new Date(asset.createdAt).toLocaleDateString("tr-TR")}</span>
              </div>
              <p className="text-sm text-slate-600 line-clamp-3">{preview}</p>
              <div className="flex items-center justify-between">
                <a href={`/assets/${asset.id}`} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                  Detay →
                </a>
                <Button variant="secondary" onClick={() => (window.location.href = `/assets/${asset.id}`)}>
                  Aç
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}


