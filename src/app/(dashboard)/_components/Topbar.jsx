"use client";

import React from "react";
import { useSession, signOut } from "next-auth/react";
import Button from "../../../components/Button";
import { FaSignOutAlt, FaUser } from "react-icons/fa";

// Türkçe yorum: Üst bar kullanıcı bilgisini ve çıkış butonunu gösterir; diğer bölümler bozulsa bile çalışır.
export default function Topbar() {
  const { data } = useSession();
  const name = data?.user?.name || "Kullanıcı";

  return (
    <div className="flex items-center justify-between border-b border-slate-200/60 bg-white/90 backdrop-blur-lg shadow-sm px-6 py-4">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-lg shadow-lg">
          {name?.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-semibold">Hoş geldiniz</p>
          <p className="font-bold text-slate-900 text-lg">{name}</p>
        </div>
      </div>
      <Button variant="secondary" icon={FaSignOutAlt} onClick={() => signOut({ callbackUrl: "/login" })}>
        Çıkış yap
      </Button>
    </div>
  );
}

 