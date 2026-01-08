"use client";

import React from "react";
import Card from "../../../components/Card";
import RegisterForm from "../../../features/auth/RegisterForm";

// Türkçe yorum: Kayıt sayfası; kullanıcı oluşturur, başka modüller olmadan çalışır.
export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 px-4">
      <Card className="w-full max-w-md space-y-5 shadow-lg">
        <div className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-blue-600">MedSocial AI</p>
          <h1 className="text-2xl font-semibold text-slate-900">Kayıt ol</h1>
          <p className="text-sm text-slate-600">Doktor profilinizle giriş yapabilmek için hesap oluşturun.</p>
        </div>
        <RegisterForm />
        <p className="text-sm text-slate-600 text-center">
          Hesabınız var mı?{" "}
          <a className="text-blue-600 hover:text-blue-700" href="/login">
            Giriş yapın
          </a>
        </p>
      </Card>
    </div>
  );
}

 