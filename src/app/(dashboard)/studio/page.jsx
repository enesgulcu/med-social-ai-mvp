"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Card from "../../../components/Card";
import Button from "../../../components/Button";
import PageHeader from "../../../components/PageHeader";
import Input from "../../../components/Input";
import Textarea from "../../../components/Textarea";
import Select from "../../../components/Select";
import LoadingSpinner from "../../../components/LoadingSpinner";
import AISuggestionModal from "../../../components/AISuggestionModal";
import { useAssetStore } from "../../../features/assets/store";

// Türkçe yorum: Studio sayfası; 5 input alanı ile içerik üretimi, AI önerileri ile desteklenir.
export default function StudioPage() {
  const { data: session } = useSession();
  const { upsertAsset } = useAssetStore();

  // Form state'leri
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [purpose, setPurpose] = useState("");
  const [targetAudience, setTargetAudience] = useState("");

  // Format ve diğer ayarlar
  const [format, setFormat] = useState("9:16");
  const [voice, setVoice] = useState("alloy");
  const [includeDisclaimerInAudio, setIncludeDisclaimerInAudio] = useState(false);
  const [visualDesignRequest, setVisualDesignRequest] = useState(""); // Görsel tasarım talebi

  // AI önerileri state'leri
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiModalField, setAiModalField] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState([]); // Sadece en son üretilen öneriler
  const [aiLoading, setAiLoading] = useState(false);
  const [allSuggestions, setAllSuggestions] = useState([]); // Tüm öneriler (yeni öneriler üstte)
  // Field bazında önerileri sakla (her field için ayrı)
  const [fieldSuggestions, setFieldSuggestions] = useState({
    topic: [],
    description: [],
    purpose: [],
    targetAudience: [],
  });

  // İçerik üretimi state'leri
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState([]);
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState([]);
  const [usedMock, setUsedMock] = useState(false);
  const [ffmpegInfo, setFfmpegInfo] = useState({ ready: null, mode: null });
  const [ffmpegAlert, setFfmpegAlert] = useState(false);
  const [lastDebugId, setLastDebugId] = useState("");

  // FFmpeg durumu kontrolü
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

  // AI önerileri üret
  const generateAISuggestions = async (field, generateNew = false, userRequest = "") => {
    setAiLoading(true);
    setAiModalField(field);
    
    // İlk kez açılıyorsa modal'ı aç, yeni örnekler için zaten açık
    if (!generateNew) {
      setAiModalOpen(true);
      setAllSuggestions([]); // İlk açılışta tüm önerileri temizle
    }

    try {
      const otherFields = {
        topic,
        description,
        purpose,
        targetAudience,
      };

      // Yeni örnekler üretiliyorsa, tüm daha önce gösterilen önerileri excludeSuggestions olarak gönder
      const excludeSuggestions = generateNew ? allSuggestions : [];
      const generationIndex = Math.floor(excludeSuggestions.length / 5);

      const res = await fetch("/api/studio/ai-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field,
          currentValue: otherFields[field] || "",
          otherFields,
          excludeSuggestions, // Daha önce gösterilen önerileri hariç tut
          generationIndex, // Kaçıncı kez yeni öneri üretiliyor
          userRequest, // Kullanıcının özel talebi
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("AI öneri API hatası:", res.status, errorData);
        // Kullanıcıya hata mesajı göster
        alert(errorData.message || errorData.error || "AI önerileri alınamadı. Lütfen daha sonra tekrar deneyin.");
        throw new Error(errorData.error || "AI önerileri alınamadı");
      }

      const data = await res.json();
      console.log("AI öneri response:", data); // Debug
      
      // Eğer hata varsa
      if (data.error) {
        console.error("AI öneri hatası:", data);
        alert(data.message || data.error || "AI önerileri alınamadı. Lütfen daha sonra tekrar deneyin.");
        setAiSuggestions([]);
        return;
      }
      
      if (data.suggestions && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        setAiSuggestions(data.suggestions);
        // Yeni önerileri üste ekle (yeni öneriler üstte, eskiler aşağıda)
        if (generateNew) {
          // Yeni önerileri üste ekle
          setAllSuggestions(prev => {
            const combined = [...data.suggestions, ...prev];
            console.log("All suggestions updated (new on top):", combined); // Debug
            return combined;
          });
        } else {
          // İlk açılışta sadece yeni önerileri göster
          setAllSuggestions(data.suggestions);
          console.log("All suggestions set (first time):", data.suggestions); // Debug
        }
        
        // Field bazında önerileri sakla
        setFieldSuggestions(prev => ({
          ...prev,
          [field]: generateNew 
            ? [...data.suggestions, ...(prev[field] || [])]
            : data.suggestions,
        }));
      } else {
        console.warn("AI önerileri boş veya geçersiz:", data);
        setAiSuggestions([]);
        alert("AI'dan öneri alınamadı. Lütfen tekrar deneyin.");
      }
    } catch (error) {
      console.error("AI öneri hatası:", error);
      // Fallback: En azından boş array göster, modal açık kalsın
      setAiSuggestions([]);
      // Kullanıcıya hata mesajı göster (opsiyonel)
    } finally {
      setAiLoading(false);
    }
  };

  // AI önerisini seç
  const handleAISelect = (suggestion) => {
    const fieldSetters = {
      topic: setTopic,
      description: setDescription,
      purpose: setPurpose,
      targetAudience: setTargetAudience,
    };

    const setter = fieldSetters[aiModalField];
    if (setter) {
      setter(suggestion);
    }
    setAiModalOpen(false);
  };

  // Yeni AI önerileri üret
  const handleGenerateNew = () => {
    // Tüm daha önce gösterilen önerileri excludeSuggestions olarak gönder
    // Yeni öneriler üret - allSuggestions'ı kullan
    generateAISuggestionsWithExclude(aiModalField, allSuggestions);
  };

  // Özel talep ile yeni AI önerileri üret
  const handleGenerateWithRequest = (userRequest) => {
    // Tüm daha önce gösterilen önerileri excludeSuggestions olarak gönder
    // Kullanıcının özel talebi ile yeni öneriler üret
    generateAISuggestionsWithExclude(aiModalField, allSuggestions, userRequest);
  };

  // excludeSuggestions ile AI önerileri üret
  const generateAISuggestionsWithExclude = async (field, excludeList = [], userRequest = "") => {
    setAiLoading(true);

    try {
      const otherFields = {
        topic,
        description,
        purpose,
        targetAudience,
      };

      console.log("Generating new suggestions, excluding:", excludeList.length, "items:", excludeList); // Debug
      if (userRequest) {
        console.log("User request:", userRequest); // Debug
      }

      const generationIndex = Math.floor(excludeList.length / 5);

      const res = await fetch("/api/studio/ai-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field,
          currentValue: otherFields[field] || "",
          otherFields,
          excludeSuggestions: excludeList, // Tüm daha önce gösterilen önerileri hariç tut
          generationIndex, // Kaçıncı kez yeni öneri üretiliyor
          userRequest, // Kullanıcının özel talebi
        }),
      });
      
      console.log("API request sent with excludeSuggestions:", excludeList.length, "items"); // Debug

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("AI öneri API hatası:", res.status, errorData);
        // Kullanıcıya hata mesajı göster
        alert(errorData.message || errorData.error || "AI önerileri alınamadı. Lütfen daha sonra tekrar deneyin.");
        throw new Error(errorData.error || "AI önerileri alınamadı");
      }

      const data = await res.json();
      console.log("AI öneri response (new):", data); // Debug
      
      // Eğer hata varsa
      if (data.error) {
        console.error("AI öneri hatası:", data);
        alert(data.message || data.error || "AI önerileri alınamadı. Lütfen daha sonra tekrar deneyin.");
        setAiSuggestions([]);
        return;
      }
      
      if (data.suggestions && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        setAiSuggestions(data.suggestions);
        // Yeni önerileri üste ekle (yeni öneriler üstte, eskiler aşağıda)
        setAllSuggestions(prev => {
          const combined = [...data.suggestions, ...prev];
          console.log("All suggestions updated (new on top):", combined); // Debug
          return combined;
        });
        
        // Field bazında önerileri sakla
        setFieldSuggestions(prev => ({
          ...prev,
          [field]: [...data.suggestions, ...(prev[field] || [])],
        }));
      } else {
        console.warn("AI önerileri boş veya geçersiz:", data);
        setAiSuggestions([]);
        alert("AI'dan öneri alınamadı. Lütfen tekrar deneyin.");
      }
    } catch (error) {
      console.error("AI öneri hatası:", error);
      setAiSuggestions([]);
    } finally {
      setAiLoading(false);
    }
  };

  // Input alanı render helper
  const renderInputWithAI = (field, label, placeholder, value, setValue, type = "input", rows = 3) => {
    const Component = type === "textarea" ? Textarea : Input;
    
    // AI butonunu pasif yapma mantığı
    const isAiButtonDisabled = () => {
      if (loading || aiLoading) return true;
      
      // "description" ve "purpose" için topic en az 3 karakter olmalı
      if ((field === "description" || field === "purpose") && (!topic || topic.trim().length < 3)) {
        return true;
      }
      
      return false;
    };
    
    const hasPreviousSuggestions = fieldSuggestions[field] && fieldSuggestions[field].length > 0;
    
    // Üretilenleri gör butonuna tıklandığında
    const handleViewPrevious = () => {
      setAiModalField(field);
      setAllSuggestions(fieldSuggestions[field] || []);
      setAiModalOpen(true);
    };
    
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-slate-700">{label}</label>
          <div className="flex items-center gap-2">
            {hasPreviousSuggestions && (
              <Button
                type="button"
                variant="outline"
                onClick={handleViewPrevious}
                disabled={loading || aiLoading}
                className="text-xs px-2 py-1"
              >
                Üretilenleri Gör ({fieldSuggestions[field].length})
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={() => generateAISuggestions(field)}
              disabled={isAiButtonDisabled()}
              className="text-xs px-2 py-1"
              title={
                (field === "description" || field === "purpose") && (!topic || topic.trim().length < 3)
                  ? "Önce konu başlığını girin (en az 3 karakter)"
                  : ""
              }
            >
              {aiLoading && aiModalField === field ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span className="ml-1">Üretiliyor...</span>
                </>
              ) : (
                "AI ile üret"
              )}
            </Button>
          </div>
        </div>
        <Component
          label=""
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={loading}
          rows={type === "textarea" ? rows : undefined}
        />
      </div>
    );
  };

  // Görsel Post hazırlama
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
          notes: `${description ? `Açıklama: ${description}. ` : ""}Amaç: ${purpose || "Bilgilendirme"}. Hedef kitle: ${targetAudience || "Genel"}`,
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

  // Video Post hazırlama
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
          notes: `${description ? `Açıklama: ${description}. ` : ""}Amaç: ${purpose || "Bilgilendirme"}. Hedef kitle: ${targetAudience || "Genel"}`,
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

      setProgress([{ step: data.success ? "Tamamlandı" : "Başarısız", status: data.success ? "success" : "error" }]);

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

      {/* Ana form - 5 input alanı */}
      <Card className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">İçerik Bilgileri</h3>
        
        {renderInputWithAI(
          "topic",
          "1. Konu *",
          "Örn: Hipertansiyon kontrolü",
          topic,
          setTopic
        )}

        {renderInputWithAI(
          "description",
          "2. Konunun açıklaması",
          "Konu hakkında kısa açıklama",
          description,
          setDescription,
          "textarea",
          3
        )}

        {renderInputWithAI(
          "purpose",
          "3. İçeriğin amacı",
          "Örn: Bilgilendirme, Hasta eğitimi",
          purpose,
          setPurpose
        )}

        {renderInputWithAI(
          "targetAudience",
          "4. İçeriğin hedef kitlesi",
          "Örn: 30-50 yaş hipertansiyon hastaları",
          targetAudience,
          setTargetAudience
        )}
      </Card>

      {/* Format ve ayarlar */}
        <Card className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Görsel Tasarım</h3>
          <Textarea
            label="Görsel tasarımınız nasıl olsun? (Opsiyonel)"
            placeholder="Örn: Vektörel bir görsel olsun, görselde yazı yazmasın, görsel gerçekçi realistik olsun, minimalist olsun, renkli olsun..."
            value={visualDesignRequest}
            onChange={(e) => setVisualDesignRequest(e.target.value)}
            disabled={loading}
            rows={3}
          />
        </Card>

        <Card className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Format ve Ayarlar</h3>
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
        </div>
        <div className="flex items-center gap-2">
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
      </Card>

      {/* Ana aksiyon butonları */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Görsel Post Hazırla</h3>
            <p className="text-sm text-slate-600">Metin + görsel içeren hazır post</p>
          </div>
          <Button onClick={handleCreateImagePost} disabled={loading || !topic.trim()} className="w-full">
            {loading ? "Üretiliyor..." : "Görsel Post Hazırla"}
          </Button>
        </Card>

        <Card className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Video Post Hazırla</h3>
            <p className="text-sm text-slate-600">Metin + görsel + ses + video içeren hazır post</p>
          </div>
          <Button onClick={handleCreateVideoPost} disabled={loading || !topic.trim()} className="w-full">
            {loading ? "Üretiliyor..." : "Video Post Hazırla"}
          </Button>
        </Card>
      </div>

      {/* FFmpeg uyarısı */}
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

      {/* Progress gösterimi */}
      {progress.length > 0 && (
        <Card className="space-y-2">
          <h3 className="font-semibold text-slate-900">İlerleme</h3>
          <div className="space-y-1">
            {progress.map((p, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                {p.status === "loading" && <LoadingSpinner size="sm" />}
                {p.status === "success" && <span className="text-green-600">✓</span>}
                {p.status === "error" && <span className="text-red-600">✗</span>}
                <span className={p.status === "error" ? "text-red-600" : "text-slate-700"}>{p.step}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Hata mesajları */}
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

      {/* Sonuç paneli */}
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
                <Button variant="secondary" onClick={() => window.location.href = `/assets/${result.id}`}>
                  Detay Görüntüle
                </Button>
                <Button variant="secondary" onClick={handleCreateImagePost} disabled={loading}>
                  Tekrar Üret
                </Button>
              </div>
            </div>
          )}

          {/* Video Post sonucu */}
          {result.type === "videoParts" && (
            <div className="space-y-6">
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

              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => window.location.href = `/assets/${result.id}`}>
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

      {/* AI Öneri Modal */}
      <AISuggestionModal
        isOpen={aiModalOpen}
        onClose={() => {
          setAiModalOpen(false);
          setAiModalField(null);
          setAiSuggestions([]);
          setAllSuggestions([]); // Modal kapanınca tüm önerileri temizle
        }}
        field={aiModalField}
        currentValue={allSuggestions} // Tüm önerileri göster
        onSelect={handleAISelect}
        onGenerateNew={handleGenerateNew}
        onGenerateWithRequest={handleGenerateWithRequest}
        loading={aiLoading}
      />
    </div>
  );
}
