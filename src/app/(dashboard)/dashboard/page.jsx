import React from "react";
import Card from "../../../components/Card";
import PageHeader from "../../../components/PageHeader";

// Türkçe yorum: Basit karşılama; modüller eksik olsa da kullanıcıya yönlendirme sunar.
export default function DashboardHome() {
  return (
    <div className="space-y-6">
      <PageHeader title="Kontrol Paneli" subtitle="Onboarding ve Studio adımlarına hızlı erişim." />
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-blue-600">Adım 1</p>
          <h3 className="text-lg font-semibold text-slate-900">Onboarding</h3>
          <p className="text-sm text-slate-600">Branş, hedef kitle ve ton bilgilerinizi tamamlayın.</p>
          <a href="/onboarding" className="mt-2 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700">
            Başla →
          </a>
        </Card>
        <Card className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-blue-600">Adım 2</p>
          <h3 className="text-lg font-semibold text-slate-900">Studio</h3>
          <p className="text-sm text-slate-600">Metin, görsel, ses ve video içeriklerini üretin.</p>
          <a href="/studio" className="mt-2 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700">
            Studio'ya git →
          </a>
        </Card>
      </div>
    </div>
  );
}

 