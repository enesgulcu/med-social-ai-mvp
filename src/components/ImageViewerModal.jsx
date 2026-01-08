import React from "react";
import Button from "./Button";

export default function ImageViewerModal({ open, src, alt = "", onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="relative max-h-full w-full max-w-6xl">
        <img src={src} alt={alt} className="w-full h-auto max-h-[90vh] rounded-md object-contain" />
        <div className="absolute top-3 right-3 flex gap-2">
          <a href={src} download className="inline-flex">
            <Button variant="secondary" className="px-3 py-1">İndir</Button>
          </a>
          <Button variant="ghost" onClick={onClose}>Kapat</Button>
        </div>
      </div>
    </div>
  );
}
