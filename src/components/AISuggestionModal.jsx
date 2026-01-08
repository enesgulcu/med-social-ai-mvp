"use client";

import React, { useState } from "react";
import Button from "./Button";
import LoadingSpinner from "./LoadingSpinner";
import Textarea from "./Textarea";

// Türkçe yorum: AI önerileri modal'ı; 5 alternatif gösterir, seçim ve yeni örnek üretme imkanı sunar.
export default function AISuggestionModal({ 
  isOpen, 
  onClose, 
  field, 
  currentValue, 
  onSelect, 
  onGenerateNew,
  onGenerateWithRequest,
  loading = false 
}) {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [userRequest, setUserRequest] = useState("");
  const [showRequestInput, setShowRequestInput] = useState(false);

  if (!isOpen) return null;

  const handleSelect = (suggestion, index) => {
    setSelectedIndex(index);
    // onSelect'i burada çağırma, sadece seçimi işaretle
  };

  const handleConfirm = () => {
    if (selectedIndex !== null && currentValue && currentValue[selectedIndex]) {
      onSelect(currentValue[selectedIndex]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="border-b border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">
              AI Önerileri - {field === "topic" ? "Konu" : 
                              field === "topicRelation" ? "Konu İlişkisi" :
                              field === "description" ? "Açıklama" :
                              field === "purpose" ? "Amaç" :
                              field === "targetAudience" ? "Hedef Kitle" : field}
            </h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-4">
          {/* Özel talep alanı */}
          {!loading && (
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">
                  Özel Talep (Opsiyonel)
                </label>
                <button
                  type="button"
                  onClick={() => setShowRequestInput(!showRequestInput)}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  {showRequestInput ? "Gizle" : "Özel talep ekle"}
                </button>
              </div>
              {showRequestInput && (
                <Textarea
                  label=""
                  placeholder="Örn: 'bana X konusu ile alakalı konu başlığı öner' veya 'daha kısa ve öz olsun' gibi özel talebinizi yazın..."
                  value={userRequest}
                  onChange={(e) => setUserRequest(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
              )}
            </div>
          )}
          
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner text="AI önerileri üretiliyor..." />
            </div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {currentValue && Array.isArray(currentValue) && currentValue.length > 0 ? (
                currentValue.map((suggestion, index) => {
                  // İlk 5 öneri yeni öneriler (üstte), sonrası eski öneriler
                  const isNew = index < 5;
                  return (
                    <button
                      key={`${suggestion}-${index}`}
                      type="button"
                      onClick={() => handleSelect(suggestion, index)}
                      className={`w-full text-left rounded-md border p-3 text-sm transition-colors ${
                        selectedIndex === index
                          ? "border-blue-600 bg-blue-50 text-blue-900"
                          : isNew
                          ? "border-green-200 bg-green-50 hover:border-green-300 hover:bg-green-100"
                          : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {isNew && (
                          <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded">
                            YENİ
                          </span>
                        )}
                        <span className="flex-1">{suggestion}</span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-500 mb-2">
                    Öneri bulunamadı.
                  </p>
                  <p className="text-xs text-slate-400">
                    Lütfen tekrar deneyin veya manuel olarak girin.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 p-4 flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>
            İptal
          </Button>
          {!loading && currentValue && currentValue.length > 0 && (
            <>
              <Button 
                variant="secondary" 
                onClick={() => {
                  if (userRequest.trim() && onGenerateWithRequest) {
                    onGenerateWithRequest(userRequest.trim());
                    setUserRequest(""); // Temizle
                  } else {
                    onGenerateNew();
                  }
                }}
              >
                {userRequest.trim() ? "Talep ile Üret" : "Yeni Örnekler Üret"}
              </Button>
            </>
          )}
          {selectedIndex !== null && currentValue && currentValue[selectedIndex] && (
            <Button onClick={handleConfirm}>
              Seç
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
