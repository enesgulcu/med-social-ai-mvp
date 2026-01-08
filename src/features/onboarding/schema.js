import { z } from "zod";

// Türkçe yorum: Onboarding doğrulaması; AI destekli süreç için güncellendi.
export const onboardingSchema = z.object({
  specialty: z.string().min(2, "Branş gerekli"),
  targetAudience: z.string().min(2, "Hedef kitle gerekli"),
  tone: z.string().min(2, "Ton seçin"),
  toneDetails: z.object({}).optional(), // AI ton analizi detayları
  goals: z.string().min(2, "Hedef belirtin"),
  visualPreferences: z
    .object({
      imageUrls: z.array(z.string()).optional(),
      visualStyle: z.string().optional(),
      tags: z.array(z.string()).optional(),
      summary: z.string().optional(),
    })
    .optional(),
});

