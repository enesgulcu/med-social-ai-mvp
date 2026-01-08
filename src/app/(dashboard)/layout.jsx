import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import prisma from "../../lib/prisma";
import Topbar from "./_components/Topbar";
import { FaHome, FaUserCircle, FaMagic, FaFolderOpen, FaCog } from "react-icons/fa";

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
    { href: "/dashboard", label: "Genel", icon: FaHome },
    { href: "/onboarding", label: "Profil Oluşturma", badge: hasCompletedOnboarding ? "Hazır" : null, icon: FaUserCircle },
    { href: "/studio", label: "Stüdyo", icon: FaMagic },
    { href: "/assets", label: "İçerikler", icon: FaFolderOpen },
    { href: "/settings", label: "Ayarlar", icon: FaCog },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 text-slate-900">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside className="hidden border-r border-slate-200/60 bg-gradient-to-b from-white via-white to-slate-50/50 backdrop-blur-lg shadow-xl lg:block">
          <div className="px-6 py-8 space-y-8 sticky top-0">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
                  <FaMagic className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.15em] bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">MedSocial AI</p>
                  <p className="text-xs text-slate-500 font-medium">Hizmet sağlayıcılar için stüdyo</p>
                </div>
              </div>
            </div>
            <nav className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon || (() => <span className="w-4 h-4">•</span>);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:text-blue-700 hover:shadow-md hover:scale-[1.02]"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 text-xs font-medium shadow-sm">
                        <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>
        <div className="flex flex-col">
          <Topbar />
          <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="page-shell space-y-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

 