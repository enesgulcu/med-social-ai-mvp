"use client";

import React from "react";
// Türkçe yorum: Bu buton atomik bir UI; diğer modüller silinse bile bağımsız çalışır.
export default function Button({ children, variant = "primary", className = "", icon: Icon, ...props }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transform active:scale-95";
  const styles = {
    primary: "bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 hover:shadow-lg hover:shadow-blue-500/30 focus:ring-blue-500",
    secondary: "bg-white text-slate-900 border-2 border-slate-200 hover:border-blue-400 hover:text-blue-700 hover:bg-blue-50/50 focus:ring-blue-200 shadow-sm",
    ghost: "bg-transparent text-slate-900 hover:bg-slate-100/80 focus:ring-slate-300 shadow-none",
  };

  const merged = [base, styles[variant] || styles.primary, className].filter(Boolean).join(" ");

  return (
    <button
      className={merged}
      {...props}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
}

