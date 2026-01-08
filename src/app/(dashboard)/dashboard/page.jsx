import React from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import prisma from "../../../lib/prisma";
import Card from "../../../components/Card";
import PageHeader from "../../../components/PageHeader";

// Türkçe yorum: Dashboard ana sayfası; onboarding durumunu kontrol eder.
export default async function DashboardHome() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return null;
  }

  // Onboarding durumunu kontrol et
  const profile = await prisma.doctorProfile.findUnique({
    where: { userId: session.user.id },
  });

  const hasCompletedOnboarding = profile && profile.specialty && profile.targetAudience && profile.tone;

  return (
    <div className="space-y-6">
      <PageHeader title="Kontrol Paneli" subtitle="AI destekli içerik üretim platformu." />
      
      {!hasCompletedOnboarding ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-blue-600">Adım 1</p>
            <h3 className="text-lg font-semibold text-slate-900">Onboarding</h3>
            <p className="text-sm text-slate-600">AI destekli profil oluşturma sürecini tamamlayın.</p>
            <a href="/onboarding" className="mt-2 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700">
              Başla →
            </a>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-blue-600">Studio</p>
            <h3 className="text-lg font-semibold text-slate-900">İçerik Üret</h3>
            <p className="text-sm text-slate-600">Metin, görsel, ses ve video içeriklerini üretin.</p>
            <a href="/studio" className="mt-2 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700">
              Studio'ya git →
            </a>
          </Card>
          <Card className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-blue-600">İçerikler</p>
            <h3 className="text-lg font-semibold text-slate-900">Üretilen İçerikler</h3>
            <p className="text-sm text-slate-600">Tüm üretilen içeriklerinizi görüntüleyin ve yönetin.</p>
            <a href="/assets" className="mt-2 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700">
              İçerikleri görüntüle →
            </a>
          </Card>
          <Card className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-blue-600">Ayarlar</p>
            <h3 className="text-lg font-semibold text-slate-900">Profil Güncelle</h3>
            <p className="text-sm text-slate-600">Onboarding bilgilerinizi güncelleyebilirsiniz.</p>
            <a href="/settings" className="mt-2 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700">
              Ayarlara git →
            </a>
          </Card>
        </div>
      )}
    </div>
  );
}
