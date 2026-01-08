import "../styles/globals.css";
import SessionProviderClient from "../components/SessionProviderClient";

// Türkçe yorum: Kök layout (Server Component) içinde client side SessionProvider kullanılamadığı için ayrı client wrapper ile sarıyoruz.
export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body className="min-h-screen bg-slate-50">
        <SessionProviderClient>{children}</SessionProviderClient>
      </body>
    </html>
  );
}

