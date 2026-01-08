import React from "react";
import Input from "../../components/Input";

// Türkçe yorum: Branş adımı; bağımsız çalışır, silinse wizard fallback gösterir.
export default function StepSpecialty({ register, errors }) {
  return (
    <div className="space-y-4">
      <Input label="Branş/Sektör" placeholder="Örn: Sağlık, E-ticaret, Eğitim, Teknoloji" {...register("specialty")} error={errors.specialty?.message} />
    </div>
  );
}

