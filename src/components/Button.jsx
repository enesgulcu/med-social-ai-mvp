import React from "react";
// Türkçe yorum: Bu buton atomik bir UI; diğer modüller silinse bile bağımsız çalışır.
export default function Button({ children, variant = "primary", className = "", ...props }) {
  const base =
    "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed";
  const styles = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
    secondary: "bg-white text-slate-900 border border-slate-200 hover:border-blue-200 hover:text-blue-700 focus:ring-blue-200",
    ghost: "bg-transparent text-slate-900 hover:bg-slate-100 focus:ring-slate-300",
  };

  const merged = [base, styles[variant] || styles.primary, className].filter(Boolean).join(" ");

  return (
    <button
      className={merged}
      {...props}
    >
      {children}
    </button>
  );
}

