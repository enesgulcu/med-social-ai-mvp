import React from "react";
import Input from "../../components/Input";

// Türkçe yorum: Hedef kitle adımı; bağımsızdır, kaldırılırsa wizard fallback mesajı gösterir.
export default function StepAudience({ register, errors }) {
  return (
    <div className="space-y-4">
      <Input
        label="Hedef kitle"
        placeholder="Örn: 30-50 yaş işletme sahipleri, 25-40 yaş teknoloji meraklıları"
        {...register("targetAudience")}
        error={errors.targetAudience?.message}
      />
    </div>
  );
}

 