import React from "react";
import Select from "../../components/Select";

// Türkçe yorum: Ton seçimi; iletişim tarzını normalize etmek için kullanılır.
export default function StepTone({ register, errors }) {
  const options = [
    { value: "", label: "Ton seçin" },
    { value: "sakin", label: "Sakin ve güven verici" },
    { value: "uzman", label: "Uzman ve kanıta dayalı" },
    { value: "samimi", label: "Samimi ve anlaşılır" },
  ];

  return (
    <div className="space-y-4">
      <Select label="Ton" options={options} {...register("tone")} error={errors.tone?.message} />
    </div>
  );
}

 