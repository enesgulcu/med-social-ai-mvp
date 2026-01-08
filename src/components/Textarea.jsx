import React from "react";

// Türkçe yorum: Uzun metin girişleri için basit textarea; forwardRef ile React Hook Form'un ref'ini kabul eder.
const Textarea = React.forwardRef(({ label, error, className = "", ...props }, ref) => {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-700">
      {label && <span>{label}</span>}
      <textarea
        ref={ref}
        className={["rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500", className].filter(Boolean).join(" ")}
        {...props}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  );
});

Textarea.displayName = "Textarea";

export default Textarea;

