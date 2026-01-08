import React from "react";

// Türkçe yorum: Basit select; opsiyon listesi ve hata göstergesi sağlar. forwardRef ile React Hook Form'un ref'ini kabul eder.
const Select = React.forwardRef(({ label, error, options = [], className = "", ...props }, ref) => {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-700">
      {label && <span>{label}</span>}
      <select
        ref={ref}
        className={["rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500", className].filter(Boolean).join(" ")}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  );
});

Select.displayName = "Select";

export default Select;

