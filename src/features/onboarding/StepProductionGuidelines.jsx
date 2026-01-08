"use client";

import React from "react";
import Textarea from "../../components/Textarea";
import { useOnboardingStore } from "./store";

export default function StepProductionGuidelines({ errors = {} }) {
  const { data, updateData } = useOnboardingStore();

  const handleChange = (e) => {
    updateData({ productionGuidelines: e.target.value });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">İçerik üretiminde dikkat edilecekler</label>
        <p className="text-xs text-slate-500 mb-4">
          Bu alana, içerik üretilirken AI'nin dikkat etmesini istediğiniz özel kuralları, marka yönergelerini, uyumluluk gereksinimlerini veya tercih ettiğiniz içerik türlerini yazın. Kısa ve net olun.
        </p>
      </div>

      <Textarea
        label="İçerik üretimi için notlar"
        placeholder={"Örn: Resmi bir dil kullan, tıbbi iddialardan kaçın, markanın mavi tonlarını vurgula, öncelikli içerik: kısa video ve infografik"}
        value={data.productionGuidelines || ""}
        onChange={handleChange}
        error={errors.productionGuidelines?.message}
        rows={6}
      />

      {data.productionGuidelines && (
        <div className="mt-2 p-3 bg-green-50 rounded-md border border-green-200 text-sm text-green-800">
          <strong>Notlar kaydedildi.</strong>
        </div>
      )}
    </div>
  );
}
