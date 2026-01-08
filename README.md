# Med Social AI — Developer README

Bu doküman, projenin amacı, çalışma mantığı, klasör yapısı, komponent/desing-system açıklamaları ve yeni bir geliştiricinin projeyi hızlıca anlamasını sağlamak için hazırlanmıştır.

Özet
- Amaç: İşletmelerin herhangi bir ajans veya tasarımcıya ihtiyaç duymadan sosyal medya için metin, görsel ve video postları hızlıca üretmesini sağlayan self-serve platform.
- Stack: Next.js (App Router), React, Prisma (MongoDB), server-side AI orchestration (OpenAI / generative clients), FFmpeg (video), lokal media arşivi (ileride S3/CDN önerisi).

Hızlı başlangıç
1. Node.js 18+ yüklü olmalı.
2. Çalışma dizininde gerekli environment değişkenlerini ayarlayın (bak: `.env.example` - henüz eklenmediyse proje sahibiyle koordinasyon).
3. Yerel geliştirme:

```bash
npm install
npm run dev
```

Ana akış (nasıl çalışır)
- Kullanıcı Studio UI'da `topic`, `description`, `purpose`, `targetAudience`, `visualDesignRequest` gibi alanları doldurur.
- `Görsel Post Hazırla` veya `Video Post Hazırla` tıklanınca client `/api/studio/image-post` veya `/api/studio/video-post` endpoint'ine POST gönderir.
- API route, `orchestrators` aracılığıyla: (1) metin üretimi, (2) governence/moderation, (3) görsel üretim (image client), (4) gerekiyorsa ses üretimi (TTS), (5) video rendering (FFmpeg) adımlarını tetikler.
- Oluşan medya `archive` ve `media` API'siyle diske yazılır; asset kayıtları Prisma ile DB'ye kaydedilir.

Folder structure (kısa)
- `src/app/` — Next.js route'ları, page/layout yapıları ve app/api serverless route'ları.
  - `app/(dashboard)/studio` — Studio UI; butonlar, modal'lar, viewer ve sonuç paneli.
  - `app/api/*` — sunucu endpoint'leri (assets, studio, media, onboarding, auth).
- `src/components/` — tekrar kullanılabilir UI bileşenleri (`Button.jsx`, `Modal.jsx`, `Card.jsx`, `Input.jsx`, vb.).
- `src/features/` — domain odaklı özellikler (ör. `studio/services`, `assets/store`). Business logic burada gruplanmış.
- `src/lib/` — yardımcı fonksiyonlar ve altyapı (db/prisma, archive, ai client wrapper'ları).
- `src/styles/` — global css/tailwind.
- `prisma/` — Prisma schema ve DB yapılandırması.

Component ve design-system (nasıl düşünülmeli)
- `src/components` içinde küçük, tek sorumluluklu, yeniden kullanılabilir bileşenler vardır (Button, Input, Card, Modal, LoadingSpinner, vb.).
- Tasarım prensipleri:
  - Tekrar kullanılabilir küçük atomlar (Button, Input)
  - Kompozisyon için Card/Modal gibi container'lar
  - Props ile görsellik kontrolü (variant, size, disabled)
  - Stil: Tailwind CSS kullanımıyla utility-first yaklaşımı
- Öneri: Storybook ekleyerek bu bileşenleri dokümante edin; prop tablosu ve görsel örnekler yeni gelen geliştiriciler için çok yardımcı olur.

Kod organizasyonu ve genişletilebilirlik
- Bizim yaklaşım: `features` klasörü altında domain-odaklı kod (UI + store + küçük servisler) var; `lib` ise platform genel yardımcılar.
- API route'ları inceleyin: server-only mantığı (AI çağrıları, prisma erişimi) route içinde veya `features/*/services` içinde yer alıyor. Yeni bir server-side feature eklerken `services` içinde fonksiyon yazıp route'dan çağırmak en temiz yol.
- Asset/AI şekilleri (contract): projede tek bir tip tanımı yok. Yeni feature eklerken `src/types` veya `src/config` altında ortak bir `asset` tipi tanımlayın; bu, UI ile backend arasındaki sürtüşmeyi azaltır.

Geliştirici yönergeleri (pratik ipuçları)
- Yeni endpoint eklerken:
  1. `features/<feature>/services` içine iş mantığını koyun.
  2. `app/api/<feature>/route.js` sadece request/response/parsing ve service çağrısı yapsın.
  3. DB erişimi `lib/prisma.js` aracılığıyla yapılsın.
- Yeni UI komponenti eklerken:
  - `src/components` içinde küçük bir dosya oluşturun, prop interface benzeri JSDoc ekleyin.
  - Storybook eklerseniz test örneklerini oraya koyun.
- Ortak konfigürasyon için `src/config/index.js` oluşturulması önerilir (env okuma ve default değerler).

Test & CI önerileri
- Kısa vadede: bir GitHub Actions workflow ekleyin (`install`, `lint`, `build`) ve 3 E2E smoke testi (studio:image, studio:video, ai-suggestions).
- Uzun vadede: Playwright + Vitest/Jest ile ayrıntılı testler.

Geliştirilebilirlik noktaları (nereden başlanmalı)
- Çok yüksek etki: `README.md` + `.env.example` + run script'leri (bittiğinde yeni geliştirici dakikalar içinde çalışır hale gelir).
- Orta vadedeki değişiklikler: `src/types` eklemek, `src/config` merkezileştirmek, `services` / `api route` sorumluluklarını netleştirmek.
- Ölçeklenebilirlik: media için S3+CDN, ağır işler için worker + queue (BullMQ/Redis) önerilir.

Dynamic Profiles & Multi-sector destek
- Amaç: proje artık yalnızca sağlık sektörü için değil; kullanıcı bazlı "DynamicProfile" ile her kullanıcı kendi sektörüne, amacına ve tercihlerine göre veri oluşturup güncelleyebilir.
- Nasıl çalışır:
  - `DynamicProfile` modeli (Prisma) user-specific ayarlar, sektör, amaç ve `preferences` JSON alanı barındırır.
  - `src/lib/dynamicProfiles.js` helper'ı ile profil oluşturma/güncelleme/fetch işlemleri yapılır.
  - AI promptları ve `ContentDNA` çağrıları, önce `DynamicProfile` (varsa) içerisinden değerler okuyarak sektör/şirket bazlı özelleştirilir; yoksa mevcut `ContentDNA` fallback kullanılır.
- Geçiş notu: `prisma/schema.prisma` dosyasına `DynamicProfile` modeli eklendi. Yeni modeli veritabanına uygulamak için:

```bash
npx prisma db push
```

veya migration ile:

```bash
npx prisma migrate dev --name add_dynamic_profile
```

Geliştiriciler için not: Mevcut `DoctorProfile` ve `ContentDNA` modelleri geriye dönük uyumluluk için korunuyor; yeni feature'lar `DynamicProfile` üzerinden okunmalı.

Ek notlar ve sonraki adımlar
- Repository'yi hızlıca geliştirici-dostu yapmak için hemen `CONTRIBUTING.md`, `.env.example`, `ARCHITECTURE.md` ekleyebilirim.
- İsterseniz şimdi `CONTRIBUTING.md` ve `ARCHITECTURE.md` dosyalarını da ekleyeyim ve basit bir GitHub Actions workflow oluşturayım.

---
Dosya referansları (başlamak için bakılacak yerler):
- `src/app/(dashboard)/studio/page.jsx` — Studio UI
- `src/features/studio/services` — AI / image / orchestrator logic
- `src/lib/archive.js` — medya kaydetme
- `src/app/api/studio/ai-suggestions/route.js` — AI suggestions endpoint
- `prisma/schema.prisma` — veri modeli

Copyright: proje sahibine aittir. Bu README geliştirici rehberi olarak eklendi.
