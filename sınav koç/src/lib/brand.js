/**
 * Marka ve genel konfigürasyon tek dosyadan yönetilir.
 * İleride isim/logo/domain değişikliği için frontend koduna dağılmadan
 * sadece bu dosya düzenlenir.
 */

export const BRAND = {
  name: "Dijital Sınav Koçu",
  shortName: "Sınav Koçu",
  tagline: "Sınava hazırlanırken ne yapacağını söyleyen dijital koç.",
  domain: "sinavkocu.com",
  supportEmail: "destek@sinavkocu.com",
  primaryColor: "#4338CA",
  primaryGradient: "linear-gradient(135deg,#4338CA,#7C3AED)",
  bgGradient: "linear-gradient(135deg,#EEF2FF,#F5F3FF)",
};

/**
 * Fiyatlandırma bilgileri tek yerden. İleride abonelik sistemi geldiğinde
 * sadece bu objenin değiştirilmesi yeterli.
 */
export const PRICING = {
  currency: "TL",
  free: {
    label: "Free",
    price: 0,
    priceLabel: "Ücretsiz",
    features: [
      "Temel dashboard",
      "Konu takibi",
      "Çalışma kaydı",
      "Ayda 3 deneme",
      "Temel istatistikler",
    ],
  },
  premium_monthly: {
    label: "Premium Aylık",
    price: 49,
    priceLabel: "49 TL/ay",
    features: [
      "Sınırsız deneme",
      "Gelişmiş deneme analizi",
      "Kişisel koçluk önerileri",
      "Detaylı performans analizi",
      "Geçmiş verilerin tamamı",
      "Öncelikli destek",
    ],
  },
  premium_yearly: {
    label: "Premium Yıllık",
    price: 449,
    priceLabel: "449 TL/yıl",
    badge: "%25 indirimli",
    features: [
      "Aylık paketteki tüm özellikler",
      "2 ay bedava",
      "Erken yeni özellikler",
    ],
  },
};

/**
 * Uygulama içinde hızlıca erişilen statik etiketler.
 */
export const SUBJECT_STATUS = {
  not_started: { label: "Başlamadım", color: "#94A3B8" },
  studying:    { label: "Çalışıyorum", color: "#0284C7" },
  completed:   { label: "Tamamlandı", color: "#059669" },
  review_needed: { label: "Tekrar Gerekli", color: "#D97706" },
  weak:        { label: "Zayıf", color: "#DC2626" },
  strong:      { label: "Çok İyi", color: "#7C3AED" },
};

export const SUBJECT_STATUS_LIST = [
  "not_started",
  "studying",
  "completed",
  "review_needed",
  "weak",
  "strong",
];

export const IMPORTANCE = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
};

export const IMPORTANCE_LIST = ["low", "medium", "high"];

/**
 * Eski (legacy) status stringleri ile yeni enum arasında mapping.
 * Eski veri import edilirken kullanılır.
 */
export const LEGACY_STATUS_MAP = {
  "Başlamadım": "not_started",
  "Çalışıyorum": "studying",
  "Tamamlandı": "completed",
  "Tekrar Gerekli": "review_needed",
  "Zayıf": "weak",
  "Çok İyi": "strong",
  "İyi": "strong", // eski koddan gelen yanlış etiket
};

export const LEGACY_IMPORTANCE_MAP = {
  "Düşük": "low",
  "Orta": "medium",
  "Yüksek": "high",
};