"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import Button from "../../components/Button";
import Input from "../../components/Input";
import { registerSchema } from "./schemas";

// Türkçe yorum: Kayıt formu; önce backend'e kullanıcı oluşturur, sonra otomatik giriş dener.
export default function RegisterForm() {
  const { register, handleSubmit, setError, formState } = useForm({
    resolver: zodResolver(registerSchema),
    mode: "onChange", // Türkçe yorum: Kullanıcı yazarken anlık validasyon yapılır, daha iyi UX.
  });
  const [loading, setLoading] = useState(false);

  const onSubmit = async (values) => {
    try {
      setLoading(true);

      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const data = await res.json();
        setError("root", { message: data?.error || "Kayıt başarısız" });
        return;
      }

      await signIn("credentials", {
        redirect: true,
        email: values.email,
        password: values.password,
        callbackUrl: "/dashboard",
      });
    } catch (error) {
      setError("root", { message: "Sunucu hatası" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Input label="Ad Soyad" {...register("name", { required: false })} error={formState.errors.name?.message} />
      <Input label="Email" type="email" {...register("email", { required: false })} error={formState.errors.email?.message} />
      <Input label="Parola" type="password" {...register("password", { required: false })} error={formState.errors.password?.message} />
      {formState.errors.root && <p className="text-sm text-red-600">{formState.errors.root.message}</p>}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Gönderiliyor..." : "Kayıt ol"}
      </Button>
    </form>
  );
}

