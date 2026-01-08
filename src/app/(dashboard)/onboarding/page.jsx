"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import Card from "../../../components/Card";
import Button from "../../../components/Button";
import PageHeader from "../../../components/PageHeader";
import LoadingSpinner from "../../../components/LoadingSpinner";
import { onboardingSchema } from "../../../features/onboarding/schema";
import { useOnboardingStore } from "../../../features/onboarding/store";
import StepSpecialtyAI from "../../../features/onboarding/StepSpecialtyAI";
import StepSectorArea from "../../../features/onboarding/StepSectorArea";
import StepAudienceAI from "../../../features/onboarding/StepAudienceAI";
import StepToneAI from "../../../features/onboarding/StepToneAI";
import StepProductionGuidelines from "../../../features/onboarding/StepProductionGuidelines";
import StepGoals from "../../../features/onboarding/StepGoals";

// Türkçe yorum: AI destekli onboarding wizard; kullanıcı ile interaktif süreç.
export default function OnboardingPage() {
  const { step, setStep, data, updateData, reset, aiState, updateAiState } = useOnboardingStore();
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const router = useRouter();

  const methods = useForm({ 
    defaultValues: data,
    mode: "onChange"
  });

  // Mevcut profil verilerini yükle
  useEffect(() => {
    const loadExistingData = async () => {
      try {
        const res = await fetch("/api/onboarding/load");
        const result = await res.json();
        
        if (result.hasProfile && result.data) {
          // Mevcut verileri store'a yükle
          updateData(result.data);
          
          // Tone analizi varsa aiState'e ekle
          if (result.data.toneDetails?.normalizedTone) {
            updateAiState({
              toneAnalysis: result.data.toneDetails,
              toneStep: 4, // Tamamlanmış sayılır
            });
          }
        }
      } catch (error) {
        console.error("Profil verileri yüklenemedi:", error);
      } finally {
        setLoading(false);
      }
    };

    loadExistingData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Türkçe yorum: Store güncellendiğinde form değerleri senkronize edilir.
  useEffect(() => {
    methods.reset(data);
  }, [data, step, methods]);

  // Ton adımında: AI analizi tamamlandıysa ama data.tone set edilmemişse, set et
  useEffect(() => {
    if (step === 3) {
      // toneAnalysis varsa ve normalizedTone varsa, data.tone'u set et
      if (aiState.toneAnalysis && aiState.toneAnalysis.normalizedTone && (!data.tone || data.tone.trim().length < 2)) {
        updateData({ tone: aiState.toneAnalysis.normalizedTone });
      }
      // toneStep 4'e ulaşmışsa ama data.tone yoksa ve toneAnalysis varsa, set et
      if (aiState.toneStep >= 4 && !data.tone && aiState.toneAnalysis && aiState.toneAnalysis.normalizedTone) {
        updateData({ tone: aiState.toneAnalysis.normalizedTone });
      }
      // toneStep 4'e ulaşmışsa ama toneAnalysis henüz gelmemişse, bekleyelim
      // Ama eğer toneStep 4 ise ve data.tone yoksa, bir default değer set edelim
      if (aiState.toneStep >= 4 && !data.tone && !aiState.toneAnalysis) {
        // Final analiz yapılmış ama henüz gelmemiş, geçici olarak bir değer set et
        // Bu durumda kullanıcı ilerleyebilir
        updateData({ tone: "AI tarafından belirlenen ton" });
      }
    }
  }, [step, aiState.toneAnalysis, aiState.toneStep, data.tone, updateData]);

  // Goals değeri değiştiğinde form'u güncelle (StepGoals component'inden gelen değişiklikler için)
  useEffect(() => {
    if (step === 4 && data.goals && methods?.setValue) {
      methods.setValue("goals", data.goals);
    }
  }, [data.goals, step, methods]);

  const steps = useMemo(
    () => [
      { title: "Sektör", Component: StepSpecialtyAI, usesRegister: false },
      { title: "Sektör Alt Alanı", Component: StepSectorArea, usesRegister: false },
      { title: "Hedef kitle", Component: StepAudienceAI, usesRegister: false },
      { title: "Ton", Component: StepToneAI, usesRegister: false },
      { title: "İçerik yönergeleri", Component: StepProductionGuidelines, usesRegister: false },
      { title: "Hedefler", Component: StepGoals, usesRegister: false },
    ],
    []
  );

  const current = steps[step] || {};
  const StepComponent = current.Component;
  const usesRegister = current.usesRegister || false;

  // Her adımın tamamlanıp tamamlanmadığını kontrol et
  const isStepComplete = useCallback(() => {
    switch (step) {
      case 0: // Sektör
        return !!((data.sector && data.sector.trim().length >= 2) || (data.specialty && data.specialty.trim().length >= 2));
      case 1: // Sektör Alt Alan
        // Alt alan isteğe bağlı değilse en az 1 karakter ile kabul et
        return !!(data.sectorArea && data.sectorArea.trim().length >= 1);
      case 2: // Hedef kitle
        return !!(data.targetAudience && data.targetAudience.trim().length >= 2);
      case 3: // Ton
        // Ton belirlenmişse tamamlanmış sayılır
        if (data.tone && data.tone.trim().length >= 2) {
          return true;
        }
        // toneAnalysis varsa ve normalizedTone varsa tamamlanmış sayılır
        if (aiState.toneAnalysis && aiState.toneAnalysis.normalizedTone) {
          return true;
        }
        // toneStep 4'e ulaşmışsa (tüm sorular cevaplanmış ve final analiz yapılmış)
        if (aiState.toneStep >= 4) {
          return true;
        }
        return false;
      case 4: // İçerik yönergeleri
        return !!(data.productionGuidelines && data.productionGuidelines.trim().length >= 5);
      case 5: // Hedefler
        // Store'dan veya form değerlerinden kontrol et
        const goalsValue = data.goals || (methods?.getValues ? methods.getValues("goals") : "");
        return !!(goalsValue && typeof goalsValue === "string" && goalsValue.trim().length >= 2);
      default:
        return false;
    }
  }, [step, data, aiState.toneAnalysis, aiState.toneStep, methods]);
  
  // Debug: isStepComplete durumunu logla (sadece development için)
  useEffect(() => {
    if (step === 2) {
      console.log("🔍 Ton adımı kontrolü:", {
        dataTone: data.tone,
        toneAnalysis: aiState.toneAnalysis,
        toneStep: aiState.toneStep,
        isComplete: isStepComplete(),
      });
    }
  }, [step, data.tone, aiState.toneAnalysis, aiState.toneStep, isStepComplete]);

  const handleSubmit = async (values) => {
    setMessage("");

    // values objesi geçersizse, boş obje olarak ayarla
    const formValues = values && typeof values === "object" && !Array.isArray(values) ? values : {};

    // Adım tamamlanmamışsa ilerleme
    if (!isStepComplete()) {
      const stepMessages = [
        "Lütfen sektörünüzü seçin veya girin.",
        "Lütfen sektörünüz içindeki alt alan veya hizmetinizi belirtin.",
        "Lütfen hedef kitlenizi belirleyin.",
        "Lütfen tüm ton sorularını cevaplayın veya manuel olarak tonunuzu girin.",
        "Lütfen hedeflerinizi girin.",
      ];
      setMessage(stepMessages[step] || "Lütfen bu adımı tamamlayın.");
      return;
    }

    // Türkçe yorum: Her adım için sadece o adımın alanını kontrol eder.
    const stepValidations = [
      { field: "sector", message: "Sektör gerekli" },
      { field: "sectorArea", message: "Sektör alt alanı gerekli" },
      { field: "targetAudience", message: "Hedef kitle gerekli" },
      { field: "tone", message: "Ton seçin" },
      { field: "goals", message: "Hedef belirtin" },
    ];

    const currentValidation = stepValidations[step];
    if (currentValidation) {
      const fieldValue = formValues[currentValidation.field] || data[currentValidation.field];
      if (!fieldValue || (typeof fieldValue === "string" && fieldValue.trim().length < 2)) {
        if (methods?.setError) {
          methods.setError(currentValidation.field, { message: currentValidation.message });
        }
        return;
      }
    }

    // Türkçe yorum: Mevcut adımın verisini store'a kaydet.
    // Sadece geçerli değerleri kaydet
    const validValues = Object.fromEntries(
      Object.entries(formValues).filter(([_, v]) => v !== undefined && v !== null && v !== "")
    );
    if (Object.keys(validValues).length > 0) {
      updateData(validValues);
    }

    // Türkçe yorum: Son adım değilse verileri draft olarak kaydet ve ilerle
    if (step < steps.length - 1) {
      // Draft kayıt (tüm verileri kaydet ama Content DNA oluşturma)
      try {
        const currentData = { ...data, ...validValues, _isDraft: true };
        // Schema validation'ı atla, sadece kaydet
        await fetch("/api/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(currentData),
        });
      } catch (error) {
        console.error("Draft kayıt hatası:", error);
        // Hata olsa bile ilerlemeye devam et
      }
      setStep(step + 1);
      return;
    }

    // Türkçe yorum: Son adımda tüm alanları Zod ile kontrol et.
    const finalData = { ...data, ...formValues };
    const parsed = onboardingSchema.safeParse(finalData);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        methods.setError(issue.path[0], { message: issue.message });
      });
      return;
    }

    try {
      setSubmitting(true);
      setMessage("Kaydediliyor...");
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!res.ok) {
        const errorData = await res.json();
        setMessage(errorData?.error || "Kaydetme hatası");
        return;
      }

      setMessage("Profil ve Content DNA kaydedildi.");
      reset();
      
      // Onboarding tamamlandıktan sonra dashboard'a yönlendir
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    } catch (error) {
      setMessage("Sunucu hatası");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Profil Oluşturma" subtitle="AI destekli profil oluşturma süreci." />
      <Card className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-blue-600">
              Adım {step + 1} / {steps.length}
            </p>
            <h2 className="text-lg font-semibold text-slate-900">{current.title || "Adım bulunamadı"}</h2>
          </div>
          <div className="flex items-center gap-2">
            {steps.map((_, idx) => {
              const isCompleted = idx < step || (idx === step && isStepComplete());
              return (
                <span
                  key={idx}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    idx === step
                      ? "bg-blue-600 ring-2 ring-blue-200 ring-offset-1"
                      : isCompleted
                      ? "bg-green-500"
                      : "bg-slate-200"
                  }`}
                  title={isCompleted ? "Tamamlandı" : idx === step ? "Devam ediyor" : "Beklemede"}
                />
              );
            })}
          </div>
        </div>

        <form className="space-y-4" onSubmit={methods.handleSubmit(handleSubmit)}>
          {StepComponent ? (
            <StepComponent 
              {...(usesRegister ? { register: methods.register } : {})}
              errors={methods.formState?.errors || {}} 
            />
          ) : (
            <p className="text-sm text-red-600">Bu adım bileşeni eksik; lütfen diğer adımlarla devam edin.</p>
          )}

          {message && (
            <div
              className={`p-3 rounded-md flex items-center gap-2 ${
                message.includes("hatası") || message.includes("Lütfen")
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-green-50 text-green-700 border border-green-200"
              }`}
            >
              {message.includes("hatası") || message.includes("Lütfen") ? (
                <span className="text-red-600">⚠</span>
              ) : (
                <span className="text-green-600">✓</span>
              )}
              <p className="text-sm">{message}</p>
            </div>
          )}

          <div className="flex justify-between">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0 || submitting}
            >
              Geri
            </Button>
            <Button 
              type="submit" 
              disabled={submitting || !isStepComplete()} 
              className="flex items-center gap-2"
              title={!isStepComplete() ? "Lütfen bu adımı tamamlayın" : ""}
            >
              {submitting && <LoadingSpinner size="sm" />}
              {submitting ? "Kaydediliyor..." : step === steps.length - 1 ? "Kaydet ve Tamamla" : "İleri"}
            </Button>
            {!isStepComplete() && step === 3 && (
              <div className="text-xs text-slate-500 mt-1 space-y-1">
                {!data.tone && !aiState.toneAnalysis && aiState.toneStep < 4 && (
                  <p>Lütfen tüm AI sorularını cevaplayın ({aiState.toneStep + 1}/4)</p>
                )}
                {aiState.toneStep >= 4 && !aiState.toneAnalysis && (
                  <p>Ton analizi yapılıyor, lütfen bekleyin...</p>
                )}
                {aiState.toneAnalysis && !data.tone && (
                  <p>Ton belirlendi, kaydediliyor...</p>
                )}
              </div>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
