"use client";

import React from "react";
import { useSession, signOut } from "next-auth/react";
import Button from "../../../components/Button";

// Türkçe yorum: Üst bar kullanıcı bilgisini ve çıkış butonunu gösterir; diğer bölümler bozulsa bile çalışır.
export default function Topbar() {
  const { data } = useSession();
  const name = data?.user?.name || "Doktor";

  return (
    <div className="flex items-center justify-between border-b border-slate-200/80 bg-white/80 backdrop-blur px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700 font-semibold">
          {name?.slice(0, 1)}
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Hoş geldiniz</p>
          <p className="font-semibold text-slate-900">{name}</p>
        </div>
      </div>
      <Button variant="secondary" onClick={() => signOut({ callbackUrl: "/login" })}>
        Çıkış yap
      </Button>
    </div>
  );
}

 