import React from "react";

// Türkçe yorum: Kart, içerik bloklarını çerçeveleyen atomik bileşen; bağımsızdır.
export default function Card({ children, className = "" }) {
  const base = "rounded-xl border border-slate-200/80 bg-white/90 backdrop-blur shadow-sm p-4";
  const merged = [base, className].filter(Boolean).join(" ");
  return <div className={merged}>{children}</div>;
}

