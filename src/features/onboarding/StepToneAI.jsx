"use client";

import React, { useState, useMemo } from "react";
import Input from "../../components/Input";
import LoadingSpinner from "../../components/LoadingSpinner";
import { useOnboardingStore } from "./store";
import { TONE_QUESTIONS, analyzeToneAnswers } from "./questions";

// Türkçe yorum: Statik ton belirleme; sorular sorar, görsel yükleme ve analiz yapar.
export default function StepToneAI({ register, errors = {} }) {
  const { data, updateData, aiState, updateAiState } = useOnboardingStore();
  const [toneAnswers, setToneAnswers] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [images, setImages] = useState(data.visualPreferences?.imageUrls || []);
  const [toneQuestions, setToneQuestions] = useState(data.toneQuestions || TONE_QUESTIONS);

  // Mevcut toneDetails varsa, soruları atla ve direkt analiz sonucunu göster
  React.useEffect(() => {
    if (data.toneDetails?.normalizedTone && !aiState.toneAnalysis) {
      updateAiState({
        toneAnalysis: data.toneDetails,
        toneStep: 4,
      });
      setCurrentQuestionIndex(toneQuestions.length); // Tüm soruları atla
    }
  }, [data.toneDetails, aiState.toneAnalysis, updateAiState]);

  // Mevcut görselleri yükle
  React.useEffect(() => {
    if (data.visualPreferences?.imageUrls && data.visualPreferences.imageUrls.length > 0) {
      setImages(data.visualPreferences.imageUrls);
    }
  }, [data.visualPreferences?.imageUrls]);

  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Veritabanından yüklenen sorular varsa kullan, yoksa statik soruları kullan
  React.useEffect(() => {
    if (data.toneQuestions && Array.isArray(data.toneQuestions) && data.toneQuestions.length > 0) {
      setToneQuestions(data.toneQuestions);
    } else if (!data.toneQuestions && TONE_QUESTIONS.length > 0) {
      // İlk kez oluşturuluyorsa statik soruları kaydet
      setToneQuestions(TONE_QUESTIONS);
      updateData({ toneQuestions: TONE_QUESTIONS });
    }
  }, [data.toneQuestions, updateData]);

  // Mevcut soruyu al (filtreleme ile)
  const currentQuestion = useMemo(() => {
    if (currentQuestionIndex >= toneQuestions.length) return null;
    const question = toneQuestions[currentQuestionIndex];
    
    // Filtreleme varsa uygula
    if (question.filters) {
      const filters = question.filters;
      let filteredOptions = [...question.options];
      
      // Önceki cevaplara göre filtrele
      if (filters.ifPreviousAnswer) {
        const prevAnswer = toneAnswers[`toneQuestion${filters.ifPreviousAnswer.questionId}`];
        if (prevAnswer && filters.ifPreviousAnswer.values.includes(prevAnswer)) {
          filteredOptions = filters.ifPreviousAnswer.showOptions.map(idx => question.options[idx]);
        }
      }
      
      if (filters.ifPreviousAnswer2) {
        const prevAnswer = toneAnswers[`toneQuestion${filters.ifPreviousAnswer2.questionId}`];
        if (prevAnswer && filters.ifPreviousAnswer2.values.includes(prevAnswer)) {
          filteredOptions = filters.ifPreviousAnswer2.showOptions.map(idx => question.options[idx]);
        }
      }
      
      return { ...question, options: filteredOptions };
    }
    
    return question;
  }, [currentQuestionIndex, toneAnswers]);

  // Tüm sorular cevaplandı mı?
  const allQuestionsAnswered = useMemo(() => {
    return toneQuestions.every((q, idx) => {
      const answerKey = `toneQuestion${idx + 1}`;
      return toneAnswers[answerKey] && toneAnswers[answerKey].trim().length > 0;
    });
  }, [toneAnswers, toneQuestions]);

  // Final analiz yap
  React.useEffect(() => {
    if (allQuestionsAnswered && currentQuestionIndex >= toneQuestions.length) {
      const analysis = analyzeToneAnswers(toneAnswers);
      updateAiState({
        toneAnalysis: analysis,
        toneStep: 4,
      });
      updateData({
        tone: analysis.normalizedTone,
        toneDetails: analysis,
      });
    }
  }, [allQuestionsAnswered, currentQuestionIndex, toneAnswers, toneQuestions, updateAiState, updateData]);

  const handleToneAnswer = (answer) => {
    const answerKey = `toneQuestion${currentQuestionIndex + 1}`;
    const newAnswers = { ...toneAnswers, [answerKey]: answer };
    setToneAnswers(newAnswers);

    // Sonraki soruya geç
    if (currentQuestionIndex < toneQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Tüm sorular cevaplandı, final analiz
      const analysis = analyzeToneAnswers(newAnswers);
      updateAiState({
        toneAnalysis: analysis,
        toneStep: 4,
      });
      updateData({
        tone: analysis.normalizedTone,
        toneDetails: analysis,
      });
    }
  };

  const handleImageUpload = async (e) => {
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length === 0) return;

    // Mevcut resimlerle birleştir, maksimum 5 resim
    const currentCount = images.length;
    const remainingSlots = 5 - currentCount;
    if (remainingSlots <= 0) {
      alert("Maksimum 5 resim yükleyebilirsiniz. Lütfen mevcut resimleri silin veya daha az resim seçin.");
      e.target.value = "";
      return;
    }

    const filesToUpload = newFiles.slice(0, remainingSlots);
    if (filesToUpload.length < newFiles.length) {
      alert(`${remainingSlots} resim yüklenecek. Toplam 5 resim sınırına ulaşıldı.`);
    }

    setUploading(true);
    try {
      const formData = new FormData();
      filesToUpload.forEach((file) => formData.append("images", file));

      const res = await fetch("/api/onboarding/upload-images", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();
      if (result.imageUrls && Array.isArray(result.imageUrls)) {
        // Yeni resimleri mevcut resimlerle birleştir
        const updatedImages = [...images, ...result.imageUrls];
        setImages(updatedImages);
        updateData({
          visualPreferences: {
            ...data.visualPreferences,
            imageUrls: updatedImages,
          },
        });

        // Tüm görselleri (eski + yeni) analiz et
        await analyzeImages(updatedImages);
      } else if (result.error) {
        console.error("Görsel yükleme hatası:", result.error);
        alert("Görseller yüklenirken bir hata oluştu. Lütfen tekrar deneyin.");
      }
    } catch (error) {
      console.error("Görsel yükleme hatası:", error);
      alert("Görseller yüklenirken bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const analyzeImages = async (imageUrls) => {
    if (imageUrls.length === 0) return;

    setAnalyzing(true);
    try {
      const res = await fetch("/api/onboarding/ai-tone-analysis", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrls,
          specialty: data.specialty,
          targetAudience: data.targetAudience,
        }),
      });

      const result = await res.json();
      if (result.visualStyle) {
        updateData({
          visualPreferences: {
            ...data.visualPreferences,
            visualStyle: result.visualStyle,
            tags: result.tags || [],
            summary: result.summary || "",
          },
        });
      }
    } catch (error) {
      console.error("Görsel analizi hatası:", error);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          İçeriklerinizde nasıl bir dil ve yaklaşım kullanmak istersiniz?
        </label>
        <p className="text-xs text-slate-500 mb-4">
          Aşağıdaki soruları cevaplayın. Ayrıca beğendiğiniz görsel örneklerini yükleyebilirsiniz.
        </p>
      </div>

      {/* Statik Sorular */}
      {currentQuestion && currentQuestionIndex < toneQuestions.length && (
        <div className="space-y-4 p-4 bg-slate-50 rounded-md border border-slate-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded">
              Soru {currentQuestionIndex + 1} / {toneQuestions.length}
            </span>
          </div>
          <p className="font-medium text-slate-900">{currentQuestion.question}</p>
          
          {currentQuestion.type === "select" && currentQuestion.options && (
            <div className="space-y-2">
              {currentQuestion.options.map((option, idx) => {
                const isSelected = toneAnswers[`toneQuestion${currentQuestionIndex + 1}`] === option;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleToneAnswer(option)}
                    className={`w-full text-left px-4 py-2 rounded-md border text-sm transition-colors ${
                      isSelected
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-slate-300 bg-white hover:border-blue-500 hover:bg-blue-50"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Görsel Yükleme */}
      <div className="space-y-2 pt-4 border-t">
        <label className="block text-sm font-medium text-slate-700">
          Beğendiğiniz görsel içeriklerden 3-5 örnek yükleyin (Opsiyonel)
        </label>
        <p className="text-xs text-slate-500 mb-2">
          Yüklediğiniz görseller AI tarafından analiz edilerek stil tercihleriniz belirlenecektir.
          {images.length > 0 && ` (${images.length}/5 yüklendi)`}
        </p>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageUpload}
          disabled={uploading || analyzing || images.length >= 5}
          className="text-sm"
        />
        {images.length >= 5 && (
          <p className="text-xs text-amber-600">Maksimum 5 resim yüklenebilir.</p>
        )}
        {uploading && <LoadingSpinner text="Görseller yükleniyor..." />}
        {analyzing && <LoadingSpinner text="Görseller analiz ediliyor..." />}

        {images.length > 0 && (
          <div className="space-y-2 mt-2">
            <div className="grid grid-cols-3 gap-2">
              {images.map((url, idx) => (
                <div key={idx} className="relative group">
                  <img
                    src={url}
                    alt={`Örnek ${idx + 1}`}
                    className="w-full h-24 object-cover rounded border"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updatedImages = images.filter((_, i) => i !== idx);
                      setImages(updatedImages);
                      updateData({
                        visualPreferences: {
                          ...data.visualPreferences,
                          imageUrls: updatedImages,
                        },
                      });
                      // Güncellenmiş görselleri tekrar analiz et
                      if (updatedImages.length > 0) {
                        analyzeImages(updatedImages);
                      } else {
                        // Tüm görseller silindi, visualPreferences'ı temizle
                        updateData({
                          visualPreferences: {
                            ...data.visualPreferences,
                            imageUrls: [],
                            visualStyle: "",
                            tags: [],
                            summary: "",
                          },
                        });
                      }
                    }}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    title="Resmi sil"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.visualPreferences?.summary && (
          <div className="mt-2 p-3 bg-green-50 rounded-md border border-green-200">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-green-600">✓</span>
              <p className="text-xs font-medium text-green-800">Görsel Analiz Raporu</p>
            </div>
            <p className="text-xs text-green-700 mb-2">{data.visualPreferences.summary}</p>
            {data.visualPreferences.visualStyle && (
              <p className="text-xs text-green-600">
                <strong>Stil:</strong> {data.visualPreferences.visualStyle}
              </p>
            )}
            {data.visualPreferences.tags && data.visualPreferences.tags.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium text-green-800 mb-1">Etiketler:</p>
                <div className="flex flex-wrap gap-1">
                  {data.visualPreferences.tags.map((tag, idx) => (
                    <span key={idx} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Final Analiz Sonucu */}
      {aiState.toneAnalysis && (
        <div className="p-4 bg-blue-50 rounded-md space-y-2 border border-blue-200">
          <div className="flex items-center gap-2">
            <span className="text-green-600">✓</span>
            <p className="font-medium text-blue-900">Ton Analizi Tamamlandı</p>
          </div>
          <p className="text-sm text-blue-800">
            <strong>Ton:</strong> {aiState.toneAnalysis.normalizedTone}
          </p>
          {aiState.toneAnalysis.description && (
            <p className="text-sm text-blue-700">{aiState.toneAnalysis.description}</p>
          )}
          {aiState.toneAnalysis.characteristics && (
            <div>
              <p className="text-sm font-medium text-blue-800">Özellikler:</p>
              <ul className="text-sm text-blue-700 list-disc list-inside">
                {aiState.toneAnalysis.characteristics.map((char, idx) => (
                  <li key={idx}>{char}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Seçilen ton gösterimi */}
      {data.tone && (
        <div className="mt-4 p-3 bg-green-50 rounded-md border border-green-200 flex items-center gap-2">
          <span className="text-green-600">✓</span>
          <p className="text-sm text-green-800">
            <strong>Ton belirlendi:</strong> {data.tone}
          </p>
        </div>
      )}
    </div>
  );
}
