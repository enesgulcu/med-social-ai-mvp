"use client";

import React, { useState } from "react";
import Input from "../../components/Input";
import { useOnboardingStore } from "./store";
import { SPECIALTY_SUGGESTIONS } from "./questions";

// Türkçe yorum: Statik branş seçimi; öneriler sunar, manuel giriş de mümkün.
export default function StepSpecialtyAI({ register, errors = {} }) {
  const { data, updateData } = useOnboardingStore();
  const [showManual, setShowManual] = useState(false);
  const [manualValue, setManualValue] = useState(data.specialty || "");

  const handleSelect = (specialty) => {
    updateData({ specialty });
    setShowManual(false);
    setManualValue("");
  };

  const handleManualChange = (e) => {
    const value = e.target.value;
    setManualValue(value);
    // Otomatik kaydet
    if (value.trim().length >= 2) {
      updateData({ specialty: value.trim() });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Branşınız nedir?</label>
        <p className="text-xs text-slate-500 mb-4">
          Popüler branşlardan birini seçin veya kendi branşınızı girin.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700 mb-2">Popüler Branşlar:</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {SPECIALTY_SUGGESTIONS.map((suggestion, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelect(suggestion)}
              className={`px-4 py-2 rounded-md border text-sm transition-colors ${
                data.specialty === suggestion
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-700 border-slate-300 hover:border-blue-500 hover:bg-blue-50"
              }`}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {!showManual ? (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowManual(true)}
            className="text-sm text-blue-600 hover:text-blue-700 underline"
          >
            Branşım listede yok, manuel gireyim
          </button>
        </div>
      ) : (
        <div className="space-y-2 pt-2">
          <Input
            label="Branşınızı girin"
            placeholder="Örn: Kardiyoloji"
            value={manualValue}
            onChange={handleManualChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && manualValue.trim().length >= 2) {
                e.preventDefault();
                setShowManual(false);
              }
            }}
            error={errors.specialty?.message}
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

      {data.specialty && (
        <div className="mt-4 p-3 bg-green-50 rounded-md border border-green-200 flex items-center gap-2">
          <span className="text-green-600">✓</span>
          <p className="text-sm text-green-800">
            <strong>Branş seçildi:</strong> {data.specialty}
          </p>
        </div>
      )}
    </div>
  );
}
