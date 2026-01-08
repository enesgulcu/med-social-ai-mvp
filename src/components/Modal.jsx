import React from "react";
import Button from "./Button";

// Türkçe yorum: Basit modal; bağımsız UI. Ebeveyn kapatsa bile uygulama devam eder.
export default function Modal({ title, open, onClose, children, actions }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-600">Bu modal blok bağımsızdır, kapanınca akış sorunsuz devam eder.</p>
          </div>
          <Button variant="ghost" onClick={onClose}>Kapat</Button>
        </div>
        <div className="mt-4">{children}</div>
        {actions && <div className="mt-6 flex justify-end gap-2">{actions}</div>}
      </div>
    </div>
  );
}

