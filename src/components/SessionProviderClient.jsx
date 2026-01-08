"use client";

import React from "react";
import { SessionProvider } from "next-auth/react";

// Türkçe yorum: SessionProvider client bileşeni olarak ayrıldı; Server Component içinde doğrudan kullanılamadığı için kök layout'ta bu sarmalayıcı kullanılır.
export default function SessionProviderClient({ children }) {
  return <SessionProvider>{children}</SessionProvider>;
}


