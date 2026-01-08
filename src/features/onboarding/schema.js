import { z } from "zod";

// Türkçe yorum: Onboarding doğrulaması; her adımı ayrı kontrol ederek eksik kritik alanları engeller.
export const onboardingSchema = z.object({
  specialty: z.string().min(2, "Branş gerekli"),
  targetAudience: z.string().min(2, "Hedef kitle gerekli"),
  tone: z.string().min(2, "Ton seçin"),
  goals: z.string().min(2, "Hedef belirtin"),
});

