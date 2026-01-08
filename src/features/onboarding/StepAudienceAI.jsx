"use client";

import React, { useState, useMemo } from "react";
import Input from "../../components/Input";
import { useOnboardingStore } from "./store";
import { AUDIENCE_QUESTIONS, AUDIENCE_SUGGESTIONS_BY_SPECIALTY } from "./questions";

// Türkçe yorum: Statik hedef kitle belirleme; sorular sorar ve öneriler sunar.
export default function StepAudienceAI({ register, errors = {} }) {
  const { data, updateData } = useOnboardingStore();
  const [answers, setAnswers] = useState({});
  const [showManual, setShowManual] = useState(false);
  const [manualValue, setManualValue] = useState(data.targetAudience || "");

  // Mevcut targetAudience varsa, parse et ve answers'a ekle
  React.useEffect(() => {
    if (data.targetAudience && !answers.age && !answers.condition && !answers.geography) {
      // Basit bir parse işlemi (örnek: "30-50 yaş hipertansiyon hastaları İstanbul")
      const audience = data.targetAudience;
      const ageMatch = audience.match(/(\d+-\d+)/);
      if (ageMatch) {
        setAnswers(prev => ({ ...prev, age: ageMatch[1] }));
      }
      // Daha gelişmiş parse için regex kullanılabilir
    }
  }, [data.targetAudience, answers]);

  // Branşa göre önerileri al
  const suggestions = useMemo(() => {
    return AUDIENCE_SUGGESTIONS_BY_SPECIALTY[data.specialty] || AUDIENCE_SUGGESTIONS_BY_SPECIALTY.default;
  }, [data.specialty]);

  const handleAnswerChange = (questionId, value) => {
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);
    
    // Tüm sorular cevaplandıysa otomatik öneri oluştur
    if (AUDIENCE_QUESTIONS.every((q) => newAnswers[q.id] && newAnswers[q.id].trim().length >= 2)) {
      generateSuggestion(newAnswers);
    }
  };

  const generateSuggestion = (allAnswers) => {
    // Cevaplardan hedef kitle önerisi oluştur
    const parts = [];
    if (allAnswers.age) parts.push(allAnswers.age);
    if (allAnswers.condition) parts.push(allAnswers.condition);
    if (allAnswers.geography) parts.push(allAnswers.geography);

    if (parts.length > 0) {
      const specialty = data.specialty || "Genel";
      const suggestion = parts.join(" ") + " için " + specialty + " içerikleri";
      updateData({ targetAudience: suggestion });
    }
  };

  const handleSuggestionSelect = (suggestion) => {
    updateData({ targetAudience: suggestion });
    setShowManual(false);
  };

  const handleManualSubmit = () => {
    if (manualValue.trim().length >= 2) {
      updateData({ targetAudience: manualValue.trim() });
      setShowManual(false);
      setManualValue("");
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
        <label className="block text-sm font-medium text-slate-700 mb-2">Hedef kitleniz kim?</label>
        <p className="text-xs text-slate-500 mb-4">
          Aşağıdaki soruları cevaplayın veya doğrudan hedef kitlenizi girin.
        </p>
      </div>

      {/* Statik Sorular */}
      <div className="space-y-4">
        {AUDIENCE_QUESTIONS.map((question) => (
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
              error={
                isAgeRange(question.id) && answers[question.id] && !validateAgeRange(answers[question.id])
                  ? "Geçerli bir yaş aralığı girin (örn: 30-50)"
                  : undefined
              }
            />
          </div>
        ))}
      </div>

      {/* Branşa Göre Öneriler */}
      {suggestions.length > 0 && (
        <div className="pt-4">
          <p className="text-sm font-medium text-slate-700 mb-2">Öneriler ({data.specialty || "Genel"}):</p>
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

      {/* Manuel Giriş */}
      {!showManual ? (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowManual(true)}
            className="text-sm text-blue-600 hover:text-blue-700 underline"
          >
            Manuel olarak hedef kitlemi gireyim
          </button>
        </div>
      ) : (
        <div className="space-y-2 pt-2">
          <Input
            label="Hedef kitlenizi girin"
            placeholder="Örn: 30-50 yaş hipertansiyon hastaları"
            value={manualValue}
            onChange={(e) => {
              setManualValue(e.target.value);
              // Otomatik kaydet
              if (e.target.value.trim().length >= 2) {
                updateData({ targetAudience: e.target.value.trim() });
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
          <button
            type="button"
            onClick={() => setShowManual(false)}
            className="text-sm text-slate-600 hover:text-slate-700 underline"
          >
            İptal
          </button>
        </div>
      )}

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
