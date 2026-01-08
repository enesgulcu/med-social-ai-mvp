"use client";

import React from "react";
import Input from "../../components/Input";
import { useOnboardingStore } from "./store";

export default function StepSectorArea({ errors = {} }) {
  const { data, updateData } = useOnboardingStore();

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Sektör Alt Alanı / Bölüm</label>
        <p className="text-xs text-slate-500 mb-4">Hangi alanda hizmet verdiğinizi girin (örn: E-ticaret, B2B SaaS, Restoran zinciri).</p>
      </div>

      <Input
        label="Sektör Alt Alanı"
        placeholder="Örn: E-ticaret, B2B SaaS, KOBİ finans, Restoran zinciri"
        value={data.sectorArea || ""}
        onChange={(e) => updateData({ sectorArea: e.target.value })}
        error={errors.sectorArea?.message}
      />

      {data.sectorArea && (
        <div className="mt-4 p-3 bg-green-50 rounded-md border border-green-200 flex items-center gap-2">
          <span className="text-green-600">✓</span>
          <p className="text-sm text-green-800">Sektör alt alanı: <strong>{data.sectorArea}</strong></p>
        </div>
      )}
    </div>
  );
}
