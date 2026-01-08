import { redirect } from "next/navigation";

// Türkçe yorum: Kök rota kullanıcıyı login sayfasına yönlendirir; gereksiz içerik yok.
export default function Home() {
  redirect("/login");
}

