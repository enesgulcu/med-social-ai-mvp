import { create } from "zustand";

// Türkçe yorum: Asset listesi için hafif client cache; API yanıtı olmasa da son bilinen veriyi gösterir.
export const useAssetStore = create((set) => ({
  assets: [],
  setAssets: (items) => set({ assets: items || [] }),
  upsertAsset: (asset) =>
    set((state) => {
      const exists = state.assets.find((a) => a.id === asset.id);
      if (exists) {
        return { assets: state.assets.map((a) => (a.id === asset.id ? asset : a)) };
      }
      return { assets: [asset, ...state.assets] };
    }),
}));


