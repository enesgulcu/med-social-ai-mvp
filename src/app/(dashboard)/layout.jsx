import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import prisma from "../../lib/prisma";
import Topbar from "./_components/Topbar";

// Türkçe yorum: Dashboard layout oturum kontrolü yapar; sidebar ve üst bar ile temel iskeleti sağlar, alt sayfalar bağımsızdır.
export default async function DashboardLayout({ children }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  // Onboarding durumunu kontrol et
  const profile = await prisma.doctorProfile.findUnique({
    where: { userId: session.user.id },
  });

  const hasCompletedOnboarding = profile && profile.specialty && profile.targetAudience && profile.tone;

  const navItems = [
    { href: "/dashboard", label: "Genel" },
    { href: "/onboarding", label: "Onboarding", badge: hasCompletedOnboarding ? "Hazır" : null },
    { href: "/studio", label: "Studio" },
    { href: "/assets", label: "İçerikler" },
    { href: "/settings", label: "Ayarlar" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="hidden border-r border-slate-200/80 bg-white/80 backdrop-blur lg:block">
          <div className="px-5 py-8 space-y-8">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">MedSocial AI</p>
              <p className="text-sm text-slate-600">Doktorlar için içerik stüdyosu</p>
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
                >
                  <div className="flex items-center gap-2">
                    <span>•</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                      {item.badge}
                    </span>
                  )}
                </Link>
              ))}
            </nav>
          </div>
        </aside>
        <div className="flex flex-col">
          <Topbar />
          <main className="flex-1 p-4 md:p-6">
            <div className="page-shell space-y-4">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

 