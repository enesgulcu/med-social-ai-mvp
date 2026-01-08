import { create } from "zustand";

// Türkçe yorum: Onboarding adımlarını ve form verisini tutan izole store; AI destekli interaktif süreç için güncellendi.
export const useOnboardingStore = create((set) => ({
  step: 0,
  data: {
    specialty: "",
    targetAudience: "",
    tone: "",
    toneDetails: {}, // AI ton analizi detayları
    goals: "",
    visualPreferences: {
      imageUrls: [],
      visualStyle: "",
      tags: [],
      summary: "",
    },
  },
  // AI destekli adımlar için state (sadece görsel analiz için)
  aiState: {
    toneStep: 0,
    toneAnalysis: null,
  },
  setStep: (step) => set({ step }),
  updateData: (partial) => set((state) => ({ data: { ...state.data, ...partial } })),
  updateAiState: (partial) => set((state) => ({ aiState: { ...state.aiState, ...partial } })),
  reset: () =>
    set({
      step: 0,
      data: {
        specialty: "",
        targetAudience: "",
        tone: "",
        toneDetails: {},
        goals: "",
        visualPreferences: {
          imageUrls: [],
          visualStyle: "",
          tags: [],
          summary: "",
        },
      },
      aiState: {
        toneStep: 0,
        toneAnalysis: null,
      },
    }),
}));

