"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import Card from "../../../components/Card";
import PageHeader from "../../../components/PageHeader";
import Input from "../../../components/Input";
import Button from "../../../components/Button";
import Select from "../../../components/Select";

// Türkçe yorum: Ayarlar sayfası; profil adı ve parola değişimi ayrı modüller olarak çalışır.
export default function SettingsPage() {
  const { data, update } = useSession();
  const [name, setName] = useState(data?.user?.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");

  // Türkçe yorum: Referanslar form state'i
  const [files, setFiles] = useState([]);
  const [preferredVisualTags, setPreferredVisualTags] = useState([]);
  const [styleNotes, setStyleNotes] = useState("");
  const [analyzeWithAI, setAnalyzeWithAI] = useState(false);

  const handleProfile = async () => {
    setMessage("");
    const res = await fetch("/api/settings/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      await update();
      setMessage("Profil güncellendi");
    } else {
      setMessage("Profil güncellenemedi");
    }
  };

  const handlePassword = async () => {
    setMessage("");
    const res = await fetch("/api/settings/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage("Parola güncellendi");
      setCurrentPassword("");
      setNewPassword("");
    } else {
      setMessage(data?.error || "Parola değiştirilemedi");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Ayarlar" subtitle="Profil ve parola yönetimi." />
      {message && <p className="text-sm text-blue-700">{message}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-3">
          <h3 className="font-semibold text-slate-900">Profil</h3>
          <Input label="Ad Soyad" value={name} onChange={(e) => setName(e.target.value)} />
          <Button onClick={handleProfile}>Kaydet</Button>
        </Card>

        <Card className="space-y-3">
          <h3 className="font-semibold text-slate-900">Parola</h3>
          <Input
            label="Mevcut parola"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <Input
            label="Yeni parola"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Button onClick={handlePassword}>Parolayı Güncelle</Button>
        </Card>
      </div>

      <Card className="space-y-3">
        <h3 className="font-semibold text-slate-900">API Anahtarları</h3>
        <p className="text-sm text-slate-600">
          API anahtarları .env dosyası üzerinden yönetilir. API key yoksa sistem otomatik olarak mock fallback kullanır.
        </p>
        <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-700">
          <p className="font-medium">Gerekli API Key'ler:</p>
          <ul className="mt-1 list-disc list-inside space-y-1">
            <li>OPENAI_API_KEY - Metin, Content DNA ve TTS için</li>
            <li>GEMINI_API_KEY - Görsel üretimi için (Google Gemini)</li>
          </ul>
          <p className="mt-2 text-slate-600">
            Tüm API key'ler opsiyoneldir; eksik olursa mock fallback devreye girer.
          </p>
        </div>
      </Card>

      {/* Türkçe yorum: Referanslar bölümü */}
      <Card className="space-y-4">
        <h3 className="font-semibold text-slate-900">Referanslar (Opsiyonel)</h3>
        <p className="text-sm text-slate-600">1-5 adet görsel/video yükleyerek istediğiniz tarzı anlatabilirsiniz.</p>

        <div className="space-y-2">
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span>Referans Medyalar</span>
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 5))}
            />
            <span className="text-xs text-slate-500">Maksimum 5 dosya. Büyük dosyalar yüklenirken bekleyiniz.</span>
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-800">Tercih edilen görsel etiketler</p>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {[
              "minimal",
              "modern",
              "pastel",
              "yüksek-kontrast",
              "flat-ikon",
              "stilize-profesyonel",
              "gerçekçi-endüstriyel",
              "monokrom",
              "yumuşak-gradyan",
            ].map((tag) => (
              <label key={tag} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={preferredVisualTags.includes(tag)}
                  onChange={(e) => {
                    setPreferredVisualTags((prev) =>
                      e.target.checked ? [...prev, tag] : prev.filter((t) => t !== tag)
                    );
                  }}
                />
                {tag}
              </label>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          <span>Stil Notları</span>
          <textarea
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Renk paleti, hissiyat, kompozisyon tercihleri..."
            value={styleNotes}
            onChange={(e) => setStyleNotes(e.target.value)}
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={analyzeWithAI} onChange={(e) => setAnalyzeWithAI(e.target.checked)} />
          AI ile kısa stil özeti çıkar (API key varsa)
        </label>

        <div>
          <Button
            onClick={async () => {
              setMessage("");
              try {
                // 1) Upload referans dosyalar (varsa)
                let referenceMediaIds = [];
                if (files.length > 0) {
                  const form = new FormData();
                  files.forEach((f) => form.append("files", f));
                  const up = await fetch("/api/upload/reference", { method: "POST", body: form });
                  const upData = await up.json();
                  if (!up.ok) {
                    setMessage(upData?.error || "Yükleme hatası");
                    return;
                  }
                  referenceMediaIds = upData.mediaIds || [];
                }

                // 2) Preferences kaydet
                const pref = await fetch("/api/settings/preferences", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    referenceMediaIds,
                    preferredVisualTags,
                    styleNotes,
                    analyzeWithAI,
                  }),
                });
                const prefRes = await pref.json();
                if (!pref.ok) {
                  setMessage(prefRes?.error || "Tercihler kaydedilemedi");
                  return;
                }

                setMessage("Referanslar kaydedildi" + (prefRes.styleSummary ? " (AI stil özeti eklendi)" : ""));
                setFiles([]);
              } catch (e) {
                setMessage("Sunucu hatası");
              }
            }}
          >
            Kaydet
          </Button>
        </div>
      </Card>
    </div>
  );
}


