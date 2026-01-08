"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import Button from "../../components/Button";
import Input from "../../components/Input";
import { loginSchema } from "./schemas";

// Türkçe yorum: Giriş formu; zod ile doğrulayıp NextAuth signIn tetikler.
export default function LoginForm() {
  const { register, handleSubmit, setError, formState } = useForm({
    resolver: zodResolver(loginSchema),
    mode: "onChange", // Türkçe yorum: Kullanıcı yazarken anlık validasyon yapılır, daha iyi UX.
  });
  const [loading, setLoading] = useState(false);

  const onSubmit = async (values) => {
    try {
      setLoading(true);

      const res = await signIn("credentials", {
        redirect: true,
        email: values.email,
        password: values.password,
        callbackUrl: "/dashboard",
      });

      if (res?.error) {
        setError("root", { message: "Giriş başarısız" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Input label="Email" type="email" {...register("email", { required: false })} error={formState.errors.email?.message} />
      <Input label="Parola" type="password" {...register("password", { required: false })} error={formState.errors.password?.message} />
      {formState.errors.root && <p className="text-sm text-red-600">{formState.errors.root.message}</p>}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Gönderiliyor..." : "Giriş yap"}
      </Button>
    </form>
  );
}

