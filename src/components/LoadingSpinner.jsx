import React from "react";

// Türkçe yorum: Loading spinner component'i; tüm yükleme durumlarında kullanılır.
export default function LoadingSpinner({ size = "md", text = "", className = "" }) {
  const sizes = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className={`${sizes[size] || sizes.md} animate-spin rounded-full border-2 border-blue-600 border-t-transparent`}
      />
      {text && <span className="text-sm text-slate-600">{text}</span>}
    </div>
  );
}
