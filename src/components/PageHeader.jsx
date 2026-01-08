import React from "react";

// Türkçe yorum: Sayfa başlıklarını standartlaştırmak için hafif bir atom.
export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.18em] text-blue-600">Panel</p>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

