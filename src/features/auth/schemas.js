import { z } from "zod";

// Türkçe yorum: Auth form doğrulaması; zayıf veriyi engelleyip sonraki katmanları korur.
export const loginSchema = z.object({
  email: z.string().min(1, "Email gerekli").email("Geçerli email girin"),
  password: z.string().min(1, "Parola gerekli").min(6, "En az 6 karakter"),
});

export const registerSchema = loginSchema.extend({
  name: z.string().min(1, "Ad soyad gerekli").min(2, "Ad soyad en az 2 karakter olmalı"),
});

