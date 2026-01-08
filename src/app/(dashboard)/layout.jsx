import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import Topbar from "./_components/Topbar";

// Türkçe yorum: Dashboard layout oturum kontrolü yapar; sidebar ve üst bar ile temel iskeleti sağlar, alt sayfalar bağımsızdır.
export default async function DashboardLayout({ children }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const navItems = [
    { href: "/dashboard", label: "Genel" },
    { href: "/onboarding", label: "Onboarding" },
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
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
                >
                  <span>•</span>
                  <span>{item.label}</span>
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

 