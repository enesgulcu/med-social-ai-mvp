"use client";

import React, { useState } from "react";
import Input from "../../components/Input";
import { useOnboardingStore } from "./store";
import { SECTOR_SUGGESTIONS } from "./questions";

// Türkçe yorum: Sektör seçimi - artık sektör bazlı onboarding. Eski 'specialty' alanı geriye dönük destek için korunur.
export default function StepSpecialtyAI({ register, errors = {} }) {
  const { data, updateData } = useOnboardingStore();
  // Eğer sector varsa ve listede yoksa, manuel input'u göster
  const [showManual, setShowManual] = useState(
    !!(data.sector && !SECTOR_SUGGESTIONS.includes(data.sector))
  );
  const [manualValue, setManualValue] = useState(data.sector || "");
  const [areaValue, setAreaValue] = useState(data.sectorArea || "");

  // data.sector ve data.sectorArea değiştiğinde state'leri güncelle
  React.useEffect(() => {
    if (data.sector && data.sector !== manualValue) {
      setManualValue(data.sector);
      // Eğer sector listede yoksa, manuel input'u göster
      if (!SECTOR_SUGGESTIONS.includes(data.sector)) {
        setShowManual(true);
      }
    }
  }, [data.sector, manualValue]);

  React.useEffect(() => {
    if (data.sectorArea !== areaValue) {
      setAreaValue(data.sectorArea || "");
    }
  }, [data.sectorArea, areaValue]);

  const handleSelect = (sector) => {
    updateData({ sector, sectorArea: "" });
    setShowManual(false);
    setManualValue("");
  };

  const handleManualChange = (e) => {
    const value = e.target.value;
    setManualValue(value);
    if (value.trim().length >= 2) {
      updateData({ sector: value.trim() });
    }
  };

  const handleAreaChange = (e) => {
    const v = e.target.value;
    setAreaValue(v);
    if (v.trim().length >= 1) updateData({ sectorArea: v.trim() });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Sektörünüz nedir?</label>
        <p className="text-xs text-slate-500 mb-4">
          Popüler sektörlerden birini seçin veya kendi sektörünüzü girin. Ardından bu sektöre özgü alt alan (ör. e-ticaret, kurumsal SaaS) belirtin.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700 mb-2">Popüler Sektörler:</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {SECTOR_SUGGESTIONS.map((suggestion, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelect(suggestion)}
              className={`px-4 py-2 rounded-md border text-sm transition-colors ${
                data.sector === suggestion
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
            Sektörüm listede yok, manuel gireyim
          </button>
        </div>
      ) : (
        <div className="space-y-2 pt-2">
          <Input
            label="Sektörünüzü girin"
            placeholder="Örn: Fintech, Yerel Perakende"
            value={manualValue}
            onChange={handleManualChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && manualValue.trim().length >= 2) {
                e.preventDefault();
                setShowManual(false);
              }
            }}
            error={errors.sector?.message}
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

      <div className="pt-2">
        <Input
          label="Sektör Alt Alan (isteğe bağlı)"
          placeholder="Örn: E-ticaret, B2B SaaS, Restoran zinciri"
          value={areaValue}
          onChange={handleAreaChange}
          error={errors.sectorArea?.message}
        />
      </div>

      {(data.sector || data.sectorArea) && (
        <div className="mt-4 p-3 bg-green-50 rounded-md border border-green-200 flex items-center gap-2">
          <span className="text-green-600">✓</span>
          <p className="text-sm text-green-800">
            <strong>Profil:</strong> {data.sector || data.specialty} {data.sectorArea ? `— ${data.sectorArea}` : ""}
          </p>
        </div>
      )}
    </div>
  );
}
