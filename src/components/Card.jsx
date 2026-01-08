"use client";

import React from "react";

// Türkçe yorum: Kart, içerik bloklarını çerçeveleyen atomik bileşen; bağımsızdır.
export default function Card({ children, className = "", hover = false }) {
  const base = "rounded-xl border border-slate-200/60 bg-gradient-to-br from-white via-white to-slate-50/50 backdrop-blur shadow-lg shadow-slate-200/20 p-6 transition-all duration-300";
  const hoverClass = hover ? "hover:shadow-xl hover:shadow-blue-200/30 hover:border-blue-300/40 hover:-translate-y-0.5" : "";
  const merged = [base, hoverClass, className].filter(Boolean).join(" ");
  return <div className={merged}>{children}</div>;
}

