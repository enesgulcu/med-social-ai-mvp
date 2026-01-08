// Türkçe yorum: Onboarding için statik sorular ve seçenekler; dinamik filtreleme desteği ile.

// Sektör önerileri (genel, sektör-agnostik)
export const SECTOR_SUGGESTIONS = [
  "Sağlık ve Wellness",
  "Perakende",
  "Finans",
  "Eğitim",
  "SaaS / Teknoloji",
  "Konaklama / Otelcilik",
  "E-ticaret",
  "Üretim",
  "Hukuk",
  "STK / Kar Amacı Gütmeyen",
];

// Hedef kitle soruları - sektöre göre dinamik oluşturulabilir
export function getAudienceQuestions(sector) {
  // Basit statik yapı; AI endpoint ile genişletilebilir
  return [
    {
      id: "age",
      question: "Hizmet verdiğiniz hedef kitlenin yaş aralığı nedir?",
      type: "text",
      placeholder: "Örn: 30-50",
      validation: {
        pattern: /^\d+-\d+$/,
        message: "Lütfen geçerli bir yaş aralığı girin (örn: 30-50)",
      },
    },
    {
      id: "topic",
      question: sector
        ? `${sector} sektöründe hangi konularda veya alanlarda hizmet veriyorsunuz?`
        : "Hangi konularda/alanlarda hizmet veriyorsunuz?",
      type: "text",
      placeholder: "Örn: Kurumsal eğitim, Öğrenci sınav hazırlığı, Bireysel ders",
    },
    {
      id: "geography",
      question: "Hizmetlerinizi hangi coğrafi bölgelerde sunuyorsunuz?",
      type: "text",
      placeholder: "Örn: İstanbul, Türkiye geneli, Online, Yurtdışı",
    },
  ];
}

// Hedef kitle önerileri (sektöre göre)
export const AUDIENCE_SUGGESTIONS_BY_SECTOR = {
  "Sağlık": [
    "30-60 yaş sağlık ve wellness hizmeti kullanıcıları",
    "Kronik durumlarla yaşayan yetişkinler",
    "Genel sağlık ve önleme bilinci olanlar",
  ],
  "Sağlık ve Wellness": [
    "30-60 yaş sağlık ve wellness hizmeti kullanıcıları",
    "Kronik durumlarla yaşayan yetişkinler",
    "Genel sağlık ve önleme bilinci olanlar",
  ],
  "Perakende": [
    "18-35 yaş düzenli online alışveriş yapanlar",
    "Sadakat programı kullanıcıları",
    "Mağaza promosyonlarına ilgi duyanlar",
  ],
  "Finans": [
    "Genç profesyoneller (25-40) yatırım ilgilileri",
    "Emeklilik planlaması yapan yetişkinler",
    "KOBİ sahibi işletme sahipleri",
  ],
  "Eğitim": [
    "Öğrenciler (18-25)",
    "Ebeveynler ve eğitimciler",
    "Yaşam boyu öğrenmeye ilgi duyan yetişkinler",
  ],
  "SaaS / Teknoloji": [
    "Ürün yöneticileri ve geliştiriciler",
    "Küçük işletme sahipleri teknoloji çözümleri arayanlar",
    "Teknoloji meraklıları ve erken benimseyenler",
  ],
  default: [
    "Genel hedef kitle",
    "İlgili demografik ve coğrafi segment",
    "İlgi ve ihtiyaçlara göre özelleştirilmiş kitle",
  ],
};

// Ton belirleme soruları (dinamik filtreleme ile)
export const TONE_QUESTIONS = [
  {
    id: 1,
    question: "İçeriklerinizde nasıl bir dil ve yaklaşım kullanmak istersiniz?",
    type: "select",
    options: [
      "Sakin ve güven verici",
      "Uzman ve kanıta dayalı",
      "Samimi ve anlaşılır",
      "Eğitici ve detaylı",
      "Motivasyonel ve destekleyici",
    ],
  },
  {
    id: 2,
    question: "İçeriklerinizde teknik terimler kullanmak ister misiniz?",
    type: "select",
    options: [
      "Evet, detaylı ve teknik",
      "Biraz, açıklamalı",
      "Hayır, tamamen basit dil",
    ],
    // Önceki cevaba göre filtreleme
    filters: {
      ifPreviousAnswer: {
        questionId: 1,
        values: ["Samimi ve anlaşılır"],
        showOptions: [1, 2], // "Biraz, açıklamalı" ve "Hayır, tamamen basit dil"
      },
    },
  },
  {
    id: 3,
    question: "Hedef kitlenizle nasıl bir ilişki kurmak istersiniz?",
    type: "select",
    options: [
      "Resmi ve profesyonel",
      "Danışman-arkadaş (samimi)",
      "Eğitici ve öğretici",
    ],
    filters: {
      ifPreviousAnswer: {
        questionId: 1,
        values: ["Uzman ve kanıta dayalı"],
        showOptions: [0], // "Resmi ve profesyonel"
      },
      ifPreviousAnswer2: {
        questionId: 1,
        values: ["Samimi ve anlaşılır"],
        showOptions: [1], // "Danışman-arkadaş (samimi)"
      },
    },
  },
  {
    id: 4,
    question: "İçeriklerinizde duygusal ton nasıl olsun?",
    type: "select",
    options: [
      "Nötr ve objektif",
      "Sıcak ve empatik",
      "Enerjik ve motivasyonel",
    ],
  },
];

// Ton analizi için mapping (seçilen cevaplara göre)
export function analyzeToneAnswers(answers) {
  const toneMap = {
    "Sakin ve güven verici": "sakin",
    "Uzman ve kanıta dayalı": "uzman",
    "Samimi ve anlaşılır": "samimi",
    "Eğitici ve detaylı": "eğitici",
    "Motivasyonel ve destekleyici": "motivasyonel",
  };

  const firstAnswer = answers.toneQuestion1;
  const normalizedTone = toneMap[firstAnswer] || "samimi";

  const descriptions = {
    sakin: "Sakin, güven verici ve profesyonel bir dil kullanılır. Endişeleri azaltmaya odaklanır.",
    uzman: "Kanıta dayalı, teknik ve profesyonel bir yaklaşım. Uzmanlık vurgulanır.",
    samimi: "Samimi, anlaşılır ve yakın bir dil. Hedef kitle ile dostane bir ilişki kurulur.",
    eğitici: "Detaylı, açıklayıcı ve eğitici bir yaklaşım. Bilgi paylaşımı ön plandadır.",
    motivasyonel: "Enerjik, destekleyici ve motive edici bir dil. Motivasyon artırılır.",
  };

  const characteristics = {
    sakin: ["Güven verici", "Profesyonel", "Sakin", "Yatıştırıcı"],
    uzman: ["Kanıta dayalı", "Teknik", "Profesyonel", "Bilimsel"],
    samimi: ["Anlaşılır", "Yakın", "Dostane", "Sade"],
    eğitici: ["Detaylı", "Açıklayıcı", "Bilgilendirici", "Öğretici"],
    motivasyonel: ["Enerjik", "Destekleyici", "Motive edici", "Pozitif"],
  };

  return {
    normalizedTone,
    description: descriptions[normalizedTone],
    characteristics: characteristics[normalizedTone] || [],
    styleGuide: {
      writingStyle: getWritingStyle(normalizedTone, answers),
      do: getDoList(normalizedTone),
      dont: getDontList(normalizedTone),
    },
  };
}

function getWritingStyle(tone, answers) {
  const technicalLevel = answers.toneQuestion2;
  const relationship = answers.toneQuestion3;
  const emotional = answers.toneQuestion4;

  let style = "";

  if (tone === "sakin") {
    style = "Sakin, güven verici ve profesyonel";
  } else if (tone === "uzman") {
    style = technicalLevel?.includes("teknik") ? "Teknik ve detaylı" : "Uzman ama anlaşılır";
  } else if (tone === "samimi") {
    style = "Samimi ve anlaşılır, halk dili";
  } else if (tone === "eğitici") {
    style = "Detaylı, açıklayıcı ve eğitici";
  } else {
    style = "Enerjik ve motivasyonel";
  }

  if (emotional === "Sıcak ve empatik") {
    style += ", empatik yaklaşım";
  } else if (emotional === "Enerjik ve motivasyonel") {
    style += ", pozitif enerji";
  }

  return style;
}

function getDoList(tone) {
  const doLists = {
    sakin: ["Güven verici ifadeler kullan", "Sakin ve profesyonel ol", "Endişeleri azalt"],
    uzman: ["Kanıt göster", "Teknik doğruluk sağla", "Uzmanlığını vurgula"],
    samimi: ["Anlaşılır dil kullan", "Örnekler ver", "Yakın ol"],
    eğitici: ["Detaylı açıkla", "Görselleştir", "Adım adım anlat"],
    motivasyonel: ["Pozitif ol", "Motive et", "Destekle"],
  };
  return doLists[tone] || doLists.samimi;
}

function getDontList(tone) {
  const dontLists = {
    sakin: ["Panik yaratma", "Aşırı teknik olma", "Soğuk olma"],
    uzman: ["Basitleştirme", "Belirsiz olma", "Kanıtsız iddia etme"],
    samimi: ["Aşırı resmi olma", "Jargon kullanma", "Uzak durma"],
    eğitici: ["Yüzeysel kalma", "Karmaşık anlatma", "Bilgi eksik bırakma"],
    motivasyonel: ["Olumsuz vurgulama", "Umutsuzluk yaratma", "Pasif kalma"],
  };
  return dontLists[tone] || dontLists.samimi;
}
