import { z } from "zod";

// Türkçe yorum: Onboarding doğrulaması; AI destekli süreç için güncellendi.
export const onboardingSchema = z
  .object({
    specialty: z.string().optional(),
    sector: z.string().optional(),
    sectorArea: z.string().optional(),
    targetAudience: z.string().min(2, "Hedef kitle gerekli"),
    audienceAnswers: z.record(z.string()).optional(), // Hedef kitle sorularının cevapları
    audienceQuestions: z.array(z.any()).nullable().optional(), // AI'dan gelen hedef kitle soruları
    audienceSuggestions: z.array(z.string()).nullable().optional(), // AI'dan gelen hedef kitle önerileri
    tone: z.string().min(2, "Ton seçin"),
    toneDetails: z.object({}).optional(), // AI ton analizi detayları
    toneQuestions: z.array(z.any()).nullable().optional(), // Ton soruları
    productionGuidelines: z.string().optional(),
    goals: z.string().min(2, "Hedef belirtin"),
    visualPreferences: z
      .object({
        imageUrls: z.array(z.string()).optional(),
        visualStyle: z.string().optional(),
        tags: z.array(z.string()).optional(),
        summary: z.string().optional(),
      })
      .optional(),
  })
  .refine((data) => !!(data.sector || data.specialty), {
    message: "Sektör veya branş girilmelidir",
    path: ["sector"],
  });

