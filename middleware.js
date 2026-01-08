export { default } from "next-auth/middleware";

// Türkçe yorum: Dashboard ve türetilmiş yollar için auth kontrolü uygular; oturumu olmayanı login'e yönlendirir.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/(dashboard)/:path*",
    "/onboarding/:path*",
    "/studio/:path*",
    "/assets/:path*",
    "/settings/:path*",
  ],
};


