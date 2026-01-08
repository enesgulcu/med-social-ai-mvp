import { create } from "zustand";

// Türkçe yorum: Onboarding adımlarını ve form verisini tutan izole store; başka feature'lara bağımlı değil.
export const useOnboardingStore = create((set) => ({
  step: 0,
  data: {
    specialty: "",
    targetAudience: "",
    tone: "",
    goals: "",
  },
  setStep: (step) => set({ step }),
  updateData: (partial) => set((state) => ({ data: { ...state.data, ...partial } })),
  reset: () => set({ step: 0, data: { specialty: "", targetAudience: "", tone: "", goals: "" } }),
}));

