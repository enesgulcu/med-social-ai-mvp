"use client";

import React from "react";
import Card from "../../../components/Card";
import LoginForm from "../../../features/auth/LoginForm";

// Türkçe yorum: Login sayfası; yalnızca formu barındırır ve diğer modüllere bağımlı değildir.
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 px-4">
      <Card className="w-full max-w-md space-y-5 shadow-lg">
        <div className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-blue-600">MedSocial AI</p>
          <h1 className="text-2xl font-semibold text-slate-900">Giriş yap</h1>
          <p className="text-sm text-slate-600">Doktor paneline erişmek için email ve parolanızı girin.</p>
        </div>
        <LoginForm />
        <p className="text-sm text-slate-600 text-center">
          Hesabınız yok mu?{" "}
          <a className="text-blue-600 hover:text-blue-700" href="/register">
            Kayıt olun
          </a>
        </p>
      </Card>
    </div>
  );
}

 