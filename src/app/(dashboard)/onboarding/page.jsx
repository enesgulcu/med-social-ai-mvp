"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import Card from "../../../components/Card";
import Button from "../../../components/Button";
import PageHeader from "../../../components/PageHeader";
import { onboardingSchema } from "../../../features/onboarding/schema";
import { useOnboardingStore } from "../../../features/onboarding/store";
import StepSpecialty from "../../../features/onboarding/StepSpecialty";
import StepAudience from "../../../features/onboarding/StepAudience";
import StepTone from "../../../features/onboarding/StepTone";
import StepGoals from "../../../features/onboarding/StepGoals";

// Türkçe yorum: Onboarding wizard; adımlar bağımsız bileşenlerdir, eksik olsalar bile fallback mesajı gösterilir.
export default function OnboardingPage() {
  const { step, setStep, data, updateData, reset } = useOnboardingStore();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const methods = useForm({ defaultValues: data });

  // Türkçe yorum: Store güncellendiğinde veya step değiştiğinde form değerleri senkronize edilir.
  useEffect(() => {
    methods.reset(data);
  }, [data, step, methods]);

  const steps = useMemo(
    () => [
      { title: "Branş", Component: StepSpecialty },
      { title: "Hedef kitle", Component: StepAudience },
      { title: "Ton", Component: StepTone },
      { title: "Hedefler", Component: StepGoals },
    ],
    []
  );

  const current = steps[step] || {};
  const StepComponent = current.Component;

  const handleSubmit = async (values) => {
    setMessage("");

    // Türkçe yorum: Her adım için sadece o adımın alanını kontrol eder.
    const stepValidations = [
      { field: "specialty", message: "Branş gerekli" },
      { field: "targetAudience", message: "Hedef kitle gerekli" },
      { field: "tone", message: "Ton seçin" },
      { field: "goals", message: "Hedef belirtin" },
    ];

    const currentValidation = stepValidations[step];
    if (currentValidation) {
      const fieldValue = values[currentValidation.field];
      if (!fieldValue || fieldValue.trim().length < 2) {
        methods.setError(currentValidation.field, { message: currentValidation.message });
        return;
      }
    }

    // Türkçe yorum: Mevcut adımın verisini store'a kaydet.
    updateData(values);

    // Türkçe yorum: Son adım değilse kaydetmeden ilerler, veri kaybını önler.
    if (step < steps.length - 1) {
      setStep(step + 1);
      return;
    }

    // Türkçe yorum: Son adımda tüm alanları Zod ile kontrol et.
    const parsed = onboardingSchema.safeParse(values);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        methods.setError(issue.path[0], { message: issue.message });
      });
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const data = await res.json();
        setMessage(data?.error || "Kaydetme hatası");
        return;
      }

      setMessage("Profil ve Content DNA kaydedildi.");
      reset();
    } catch (error) {
      setMessage("Sunucu hatası");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Onboarding" subtitle="Branş, hedef kitle, ton ve hedefleri girin." />
      <Card className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-blue-600">
              Adım {step + 1} / {steps.length}
            </p>
            <h2 className="text-lg font-semibold text-slate-900">{current.title || "Adım bulunamadı"}</h2>
          </div>
          <div className="flex items-center gap-2">
            {steps.map((_, idx) => (
              <span key={idx} className={`h-2 w-2 rounded-full ${idx === step ? "bg-blue-600" : "bg-slate-200"}`} />
            ))}
          </div>
        </div>

        <form className="space-y-4" onSubmit={methods.handleSubmit(handleSubmit)}>
          {StepComponent ? (
            <StepComponent register={methods.register} errors={methods.formState.errors} />
          ) : (
            <p className="text-sm text-red-600">Bu adım bileşeni eksik; lütfen diğer adımlarla devam edin.</p>
          )}

          {message && <p className="text-sm text-blue-700">{message}</p>}

          <div className="flex justify-between">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0 || submitting}
            >
              Geri
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Kaydediliyor..." : step === steps.length - 1 ? "Kaydet" : "İleri"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}


