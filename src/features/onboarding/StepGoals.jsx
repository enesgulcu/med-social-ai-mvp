"use client";

import React from "react";
import Textarea from "../../components/Textarea";
import { useOnboardingStore } from "./store";

// Türkçe yorum: Hedefler adımı; kullanıcının içerik amaçlarını netleştirir.
export default function StepGoals({ register, errors }) {
  const { data, updateData } = useOnboardingStore();
  const [goalsValue, setGoalsValue] = React.useState(data.goals || "");

  // Store'dan gelen değişiklikleri senkronize et
  React.useEffect(() => {
    if (data.goals !== goalsValue) {
      setGoalsValue(data.goals || "");
    }
  }, [data.goals]);

  const handleChange = (e) => {
    const value = e.target.value;
    setGoalsValue(value);
    // Otomatik olarak store'a kaydet
    updateData({ goals: value });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Hedefler</label>
        <p className="text-xs text-slate-500 mb-4">
          İçerik üretiminde ulaşmak istediğiniz hedefleri belirtin.
        </p>
      </div>
      <Textarea
        label="Hedefler"
        placeholder="Örn: Bilgilendirme, müşteri eğitimi, marka bilinirliği, satış artırma"
        rows={4}
        value={goalsValue}
        onChange={handleChange}
        error={errors?.goals?.message}
      />
      {goalsValue && goalsValue.trim().length >= 2 && (
        <div className="mt-2 p-3 bg-blue-50 rounded-md">
          <p className="text-xs text-blue-800">
            <strong>Hedefler kaydedildi:</strong> {goalsValue.length} karakter
          </p>
        </div>
      )}
    </div>
  );
}


