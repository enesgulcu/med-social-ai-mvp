"use client";

import React, { useState, useMemo, useEffect } from "react";
import Input from "../../components/Input";
import LoadingSpinner from "../../components/LoadingSpinner";
import { useOnboardingStore } from "./store";
import { getAudienceQuestions, AUDIENCE_SUGGESTIONS_BY_SECTOR } from "./questions";

// Türkçe yorum: Statik hedef kitle belirleme; sorular sorar ve öneriler sunar.
export default function StepAudienceAI({ register, errors = {} }) {
  const { data, updateData } = useOnboardingStore();
  const [answers, setAnswers] = useState(data.audienceAnswers || {});
  const [manualValue, setManualValue] = useState(data.targetAudience || "");
  const [questions, setQuestions] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingAI, setLoadingAI] = useState(true);

  // data.targetAudience değiştiğinde manualValue'yu güncelle
  React.useEffect(() => {
    if (data.targetAudience && data.targetAudience !== manualValue) {
      setManualValue(data.targetAudience);
    }
  }, [data.targetAudience, manualValue]);

  useEffect(() => {
    let mounted = true;
    let timeoutId = null;
    
    async function loadDynamic() {
      // Önce veritabanından kaydedilmiş soruları kontrol et
      if (data.audienceQuestions && Array.isArray(data.audienceQuestions) && data.audienceQuestions.length > 0) {
        // Veritabanından yükle - AI'ya istek atma
        const filteredQuestions = data.audienceQuestions.filter(q => 
          !q.question?.toLowerCase().includes("hedef müşteri") && 
          !q.question?.toLowerCase().includes("hedef kitle") &&
          !q.question?.toLowerCase().includes("hedef müşteri kitleniz")
        );
        setQuestions(filteredQuestions);
        if (data.audienceSuggestions && Array.isArray(data.audienceSuggestions) && data.audienceSuggestions.length > 0) {
          setSuggestions(data.audienceSuggestions);
        } else {
          setSuggestions(
            (AUDIENCE_SUGGESTIONS_BY_SECTOR[data.sector] || AUDIENCE_SUGGESTIONS_BY_SECTOR.default) || []
          );
        }
        setLoadingAI(false);
        return;
      }
      
      // Veritabanında yoksa AI'dan çek
      setLoadingAI(true);
      
      // 30 saniye timeout
      timeoutId = setTimeout(() => {
        if (mounted) {
          // Timeout: fallback to static
          const fallbackQuestions = getAudienceQuestions(data.sector);
          // "Hedef müşteri kitleniz kimlerdir?" sorusunu filtrele
          const filteredQuestions = fallbackQuestions.filter(q => 
            !q.question.toLowerCase().includes("hedef müşteri") && 
            !q.question.toLowerCase().includes("hedef kitle") &&
            !q.question.toLowerCase().includes("hedef müşteri kitleniz")
          );
          setQuestions(filteredQuestions);
          setSuggestions(
            (AUDIENCE_SUGGESTIONS_BY_SECTOR[data.sector] || AUDIENCE_SUGGESTIONS_BY_SECTOR.default) || []
          );
          setLoadingAI(false);
        }
      }, 30000);
      
      try {
        const res = await fetch("/api/onboarding/ai-questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sector: data.sector, sectorArea: data.sectorArea, role: "provider" }),
        });
        const result = await res.json();
        
        if (!mounted) return;
        
        // Clear timeout if AI responded
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        if (result.ok && result.questions) {
          // "Hedef müşteri kitleniz kimlerdir?" sorusunu filtrele
          const filteredQuestions = result.questions.filter(q => 
            !q.question.toLowerCase().includes("hedef müşteri") && 
            !q.question.toLowerCase().includes("hedef kitle") &&
            !q.question.toLowerCase().includes("hedef müşteri kitleniz")
          );
          setQuestions(filteredQuestions);
          // Veritabanına kaydet
          updateData({ 
            audienceQuestions: filteredQuestions,
            audienceSuggestions: result.suggestions || []
          });
        } else {
          // Fallback if AI didn't return questions
          const fallbackQuestions = getAudienceQuestions(data.sector);
          // "Hedef müşteri kitleniz kimlerdir?" sorusunu filtrele
          const filteredQuestions = fallbackQuestions.filter(q => 
            !q.question.toLowerCase().includes("hedef müşteri") && 
            !q.question.toLowerCase().includes("hedef kitle") &&
            !q.question.toLowerCase().includes("hedef müşteri kitleniz")
          );
          setQuestions(filteredQuestions);
        }
        
        if (result.ok && result.suggestions) {
          setSuggestions(result.suggestions);
          // Veritabanına kaydet
          if (!data.audienceSuggestions) {
            updateData({ audienceSuggestions: result.suggestions });
          }
        } else {
          // Fallback if AI didn't return suggestions
          const fallbackSuggestions = (AUDIENCE_SUGGESTIONS_BY_SECTOR[data.sector] || AUDIENCE_SUGGESTIONS_BY_SECTOR.default) || [];
          setSuggestions(fallbackSuggestions);
        }
        
        setLoadingAI(false);
      } catch (e) {
        // Error: fallback to static
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (mounted) {
          const fallbackQuestions = getAudienceQuestions(data.sector);
          // "Hedef müşteri kitleniz kimlerdir?" sorusunu filtrele
          const filteredQuestions = fallbackQuestions.filter(q => 
            !q.question.toLowerCase().includes("hedef müşteri") && 
            !q.question.toLowerCase().includes("hedef kitle") &&
            !q.question.toLowerCase().includes("hedef müşteri kitleniz")
          );
          setQuestions(filteredQuestions);
          setSuggestions(
            (AUDIENCE_SUGGESTIONS_BY_SECTOR[data.sector] || AUDIENCE_SUGGESTIONS_BY_SECTOR.default) || []
          );
          setLoadingAI(false);
        }
      }
    }

    loadDynamic();
    return () => {
      mounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [data.sector, data.sectorArea, data.audienceQuestions, data.audienceSuggestions, updateData]);

  // data.audienceAnswers değiştiğinde answers'ı güncelle
  React.useEffect(() => {
    if (data.audienceAnswers && Object.keys(data.audienceAnswers).length > 0) {
      setAnswers(data.audienceAnswers);
    }
  }, [data.audienceAnswers]);

  // Sektöre veya branşa göre önerileri al
  // suggestions state provided by AI endpoint or fallback mapping

  const handleAnswerChange = (questionId, value) => {
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);
    // Cevapları store'a kaydet
    updateData({ audienceAnswers: newAnswers });

    // Tüm sorular cevaplandıysa otomatik öneri oluştur
    if (questions.every((q) => newAnswers[q.id] && newAnswers[q.id].trim().length >= 2)) {
      generateSuggestion(newAnswers);
    }
  };

  const generateSuggestion = (allAnswers) => {
    // Cevaplardan hedef kitle önerisi oluştur
    const parts = [];
    if (allAnswers.age) parts.push(allAnswers.age);
    if (allAnswers.topic) parts.push(allAnswers.topic);
    if (allAnswers.geography) parts.push(allAnswers.geography);

    if (parts.length > 0) {
      const sectorLabel = data.sector || data.specialty || "Genel";
      const suggestion = parts.join(" ") + " için " + sectorLabel + " içerikleri";
      updateData({ targetAudience: suggestion });
    }
  };

  const handleSuggestionSelect = (suggestion) => {
    updateData({ targetAudience: suggestion });
    setManualValue(suggestion);
  };

  const handleManualSubmit = () => {
    if (manualValue.trim().length >= 2) {
      updateData({ targetAudience: manualValue.trim() });
    }
  };

  // Yaş aralığı için özel input kontrolü
  const isAgeRange = (questionId) => {
    return questionId === "age";
  };

  // Yaş aralığı formatını kontrol et (örn: "30-50", "18-30")
  const validateAgeRange = (value) => {
    if (!value) return true;
    const pattern = /^\d+-\d+$/;
    return pattern.test(value.trim());
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">İşletmeniz / Verdiğiniz Hizmetler</label>
        <p className="text-xs text-slate-500 mb-4">
          Buraya işletmenizin sunduğu hizmetleri, formatları ve hedeflediğiniz müşteri segmentlerini girin. Bu bilgiler içerik üretimi için kullanılacak.
        </p>
      </div>

      {/* Loading State */}
      {loadingAI && (
        <div className="space-y-4 p-4 bg-blue-50 rounded-md border border-blue-200">
          <LoadingSpinner text="AI soruları yükleniyor... (Maksimum 30 saniye)" />
        </div>
      )}

      {/* Sorular */}
      {!loadingAI && questions.length > 0 && (
        <div className="space-y-4">
          {questions
            .filter(q => 
              !q.question.toLowerCase().includes("hedef müşteri") && 
              !q.question.toLowerCase().includes("hedef kitle") &&
              !q.question.toLowerCase().includes("hedef müşteri kitleniz")
            )
            .map((question) => (
            <div key={question.id} className="space-y-2">
              <Input
                label={question.question}
                placeholder={question.placeholder || "Cevabınızı girin"}
                value={answers[question.id] || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  if (isAgeRange(question.id)) {
                    // Sadece rakam ve tire kabul et
                    const filtered = value.replace(/[^\d-]/g, "");
                    handleAnswerChange(question.id, filtered);
                  } else {
                    handleAnswerChange(question.id, value);
                  }
                }}
                onBlur={(e) => {
                  if (isAgeRange(question.id) && !validateAgeRange(e.target.value)) {
                    alert("Lütfen geçerli bir yaş aralığı girin (örn: 30-50)");
                  }
                }}
                error={isAgeRange(question.id) && answers[question.id] && !validateAgeRange(answers[question.id]) ? "Geçerli bir yaş aralığı girin (örn: 30-50)" : undefined}
              />
            </div>
          ))}
        </div>
      )}

      {/* Branşa Göre Öneriler */}
      {!loadingAI && suggestions.length > 0 && (
        <div className="pt-4">
          <p className="text-sm font-medium text-slate-700 mb-2">Öneriler ({data.sector || data.specialty || "Genel"}):</p>
          <div className="space-y-2">
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSuggestionSelect(suggestion)}
                className={`w-full text-left px-4 py-2 rounded-md border text-sm transition-colors ${
                  data.targetAudience === suggestion
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-700 border-slate-300 hover:border-blue-500 hover:bg-blue-50"
                }`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Manuel Giriş - Varsayılan olarak göster */}
      <div className="space-y-2 pt-4 border-t">
        <Input
          label="Hedef kitlenizi girin"
          placeholder="Örn: 30-50 yaş işletme sahipleri, 25-40 yaş teknoloji meraklıları"
          value={manualValue}
          onChange={(e) => {
            setManualValue(e.target.value);
            // Otomatik kaydet
            if (e.target.value.trim().length >= 2) {
              updateData({ targetAudience: e.target.value.trim() });
            } else {
              // Boşsa temizle
              updateData({ targetAudience: "" });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && manualValue.trim().length >= 2) {
              e.preventDefault();
              handleManualSubmit();
            }
          }}
          error={errors.targetAudience?.message}
        />
        <p className="text-xs text-slate-500">
          Hedef kitlenizi doğrudan girebilir veya yukarıdaki önerilerden birini seçebilirsiniz.
        </p>
      </div>

      {data.targetAudience && (
        <div className="mt-4 p-3 bg-green-50 rounded-md border border-green-200 flex items-center gap-2">
          <span className="text-green-600">✓</span>
          <p className="text-sm text-green-800">
            <strong>Hedef kitle belirlendi:</strong> {data.targetAudience}
          </p>
        </div>
      )}
    </div>
  );
}
