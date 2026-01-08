import React from "react";

// Türkçe yorum: Input basit bir form elemanı; RHF veya standalone kullanılabilir. forwardRef ile React Hook Form'un ref'ini kabul eder.
const Input = React.forwardRef(({ label, error, className = "", required, ...props }, ref) => {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-700">
      {label && <span>{label}</span>}
      <input
        ref={ref}
        className={["rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500", className].filter(Boolean).join(" ")}
        {...props}
        // HTML5 required attribute'unu kaldırıyoruz, Zod validasyonu kullanılıyor
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  );
});

Input.displayName = "Input";

export default Input;

