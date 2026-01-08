import React from "react";
import Textarea from "../../components/Textarea";

// Türkçe yorum: Hedefler adımı; doktorun içerik amaçlarını netleştirir.
export default function StepGoals({ register, errors }) {
  return (
    <div className="space-y-4">
      <Textarea
        label="Hedefler"
        placeholder="Örn: Bilgilendirme, hasta eğitimi, kliniğe yönlendirme"
        rows={4}
        {...register("goals")}
        error={errors.goals?.message}
      />
    </div>
  );
}


