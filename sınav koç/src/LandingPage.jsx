import React, { useState } from "react";
import { Target, Brain, BarChart3, Calendar, Sparkles, ChevronDown, Check, X as XIcon, ArrowRight } from "lucide-react";
import { BRAND, PRICING } from "./lib/brand";
import { LoginScreen, RegisterScreen } from "./AuthScreens";
import { useAuth } from "./useAuth";

/**
 * Public landing page. Auth gerektirmez.
 * Hero, Problem, Çözüm, Özellikler, Sınavlar, Free vs Premium, Fiyat, FAQ, CTA.
 */

const PROBLEMS = [
  { title: "Ne çalışacağını bilemiyorum", desc: "Konu listesinde kayboluyorsun, nereden başlayacağını bilmiyorsun." },
  { title: "Plan yapamıyorum", desc: "Her gün 'bugün ne yapsam' diye düşünüp zaman kaybediyorsun." },
  { title: "Eksiklerimi göremiyorum", desc: "Hangi konuda zayıf olduğunu bilmeden çalışmaya devam ediyorsun." },
  { title: "Denemeleri analiz edemiyorum", desc: "Netlerini giriyorsun ama yorumlanmış, anlamlı bir dönüş alamıyorsun." },
  { title: "İlerlememi ölçemiyorum", desc: "Dün ne kadar çalıştın, geçen haftaya göre nasılsın, göremiyorsun." },
];

const FEATURES = [
  { icon: Brain,    title: "Akıllı Çalışma Planı", desc: "Senin verilerinden öğrenen, günlük görevleri öncelik sırasına göre üreten plan." },
  { icon: BarChart3,title: "Deneme Analizi",         desc: "Denemelerini gir, ders ve konu bazlı trendleri, yükselişleri ve düşüşleri gör." },
  { icon: Calendar, title: "Çalışma Takvimi",       desc: "Pomodoro, günlük plan, haftalık hedef — hepsi tek bir takvimde." },
  { icon: Sparkles, title: "Kişisel Koçluk",        desc: "Verilerinden üretilen gerçekçi öneriler. 'Matematikte düşüş var, bugün problem çöz.' gibi." },
];

const EXAMS = [
  { code: "kpss", name: "KPSS", short: "Ortaöğretim / Genel Yetenek + Genel Kültür", color: "#4F46E5" },
  { code: "yks",  name: "YKS",  short: "TYT + AYT, alanına özel dersler",             color: "#059669" },
  { code: "lgs",  name: "LGS",  short: "Sayısal + Sözel, 6. sınıf düzeyi",            color: "#D97706" },
];

const FAQ = [
  { q: "Ücretsiz mi başlayabilirim?", a: "Evet. Free planda temel dashboard, konu takibi, çalışma kaydı ve ayda 3 deneme hakkın var." },
  { q: "KPSS dışında sınavlar da var mı?", a: "Evet. YKS (TYT + AYT) ve LGS destekleniyor. Yeni sınavlar düzenli olarak ekleniyor." },
  { q: "Verilerim güvende mi?", a: "Tüm veriler Supabase altyapısında, sadece senin hesabına bağlı RLS politikalarıyla korunuyor. Sunucuya üçüncü taraf erişimi yok." },
  { q: "Aboneliğimi nasıl yönetirim?", a: "Ayarlar > Abonelik bölümünden iptal edebilir, plan değiştirebilirsin. İstediğin zaman, gizli ücret yok." },
  { q: "Telefondan kullanabilir miyim?", a: "Evet. Uygulama mobile-first tasarım, telefondaki tarayıcıdan veya PWA olarak kullanabilirsin." },
];

function useFaqState() {
  const [open, setOpen] = useState(null);
  return [open, (i) => setOpen(open === i ? null : i)];
}

export default function LandingPage() {
  const { session } = useAuth();
  const [authView, setAuthView] = useState(null); // null | "login" | "register"
  const [openFaq, toggleFaq] = useFaqState();

  // Oturum varsa dashboard'a yönlendirme hook'u burada çağrılmaz,
  // App.jsx zaten bunu yönetiyor.

  if (authView === "register") {
    return <RegisterScreen auth={null} onGoLogin={() => setAuthView("login")} />;
  }
  if (authView === "login") {
    return <LoginScreen auth={null} onGoRegister={() => setAuthView("register")} onGoForgot={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-white text-slate-800">
      {/* NAV */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: BRAND.primaryGradient }}>
              <Target className="text-white" size={16} />
            </div>
            <span className="font-bold text-slate-800">{BRAND.name}</span>
          </a>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            <a href="#features" className="hover:text-slate-900">Özellikler</a>
            <a href="#exams" className="hover:text-slate-900">Sınavlar</a>
            <a href="#pricing" className="hover:text-slate-900">Fiyat</a>
            <a href="#faq" className="hover:text-slate-900">SSS</a>
          </nav>
          <div className="flex items-center gap-2">
            {session ? (
              <a href="#dashboard" className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
                Panele Git
              </a>
            ) : (
              <>
                <button onClick={() => setAuthView("login")} className="px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900">
                  Giriş
                </button>
                <button onClick={() => setAuthView("register")} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
                  Ücretsiz Başla
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* HERO */}
      <section id="top" className="px-4 sm:px-6 py-16 sm:py-24" style={{ background: BRAND.bgGradient }}>
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium mb-6">
            <Sparkles size={14} /> KPSS · YKS · LGS ve daha fazlası
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 leading-tight tracking-tight">
            Sınava hazırlanırken <span style={{ backgroundImage: BRAND.primaryGradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>ne yapacağını söyleyen</span> dijital koç.
          </h1>
          <p className="mt-5 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
            Çalışmalarını, denemelerini ve hedeflerini tek bir yerde topla. Sana özel öneriler, gerçek verilerinden üretilir — sahte motivasyon cümleleri değil.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => setAuthView("register")} className="px-6 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 flex items-center justify-center gap-2">
              Ücretsiz Başla <ArrowRight size={16} />
            </button>
            <a href="#features" className="px-6 py-3 rounded-lg bg-white border border-slate-200 text-slate-700 font-medium hover:bg-slate-50">
              Nasıl Çalışır?
            </a>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="px-4 sm:px-6 py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-3">Seni tanıyoruz.</h2>
          <p className="text-slate-600 text-center max-w-2xl mx-auto mb-10">Çoğu öğrenci sınava hazırlanırken aynı şeyleri yaşıyor.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PROBLEMS.map((p) => (
              <div key={p.title} className="rounded-2xl border border-slate-100 bg-white p-5">
                <div className="text-base font-semibold text-slate-800 mb-1.5">{p.title}</div>
                <div className="text-sm text-slate-500">{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ÇÖZÜM / ÖZELLİKLER */}
      <section id="features" className="px-4 sm:px-6 py-16 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-3">Veri odaklı bir koç.</h2>
          <p className="text-slate-600 text-center max-w-2xl mx-auto mb-10">Senin verilerinden öğrenen, gerçek hesaplamalarla çalışan bir sistem.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-slate-100 bg-white p-6">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                  <f.icon size={20} />
                </div>
                <div className="text-base font-semibold text-slate-800 mb-1.5">{f.title}</div>
                <div className="text-sm text-slate-500">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SINAVLAR */}
      <section id="exams" className="px-4 sm:px-6 py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-3">Hangi sınava hazırlanıyorsun?</h2>
          <p className="text-slate-600 text-center max-w-2xl mx-auto mb-10">Her sınavın kendine özgü dersleri, konuları ve puanlama sistemi var. Sistem bunları bilir.</p>
          <div className="grid sm:grid-cols-3 gap-4">
            {EXAMS.map((e) => (
              <div key={e.code} className="rounded-2xl border border-slate-100 bg-white p-6 text-center">
                <div className="text-2xl font-extrabold mb-2" style={{ color: e.color }}>{e.name}</div>
                <div className="text-sm text-slate-500">{e.short}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FREE VS PREMIUM */}
      <section className="px-4 sm:px-6 py-16 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-3">Free vs Premium</h2>
          <p className="text-slate-600 text-center max-w-2xl mx-auto mb-10">Önce ürünü kullan, faydayı gör, sonra Premium'a geç.</p>
          <div className="grid md:grid-cols-2 gap-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="text-base font-semibold text-slate-800 mb-1">{PRICING.free.label}</div>
              <div className="text-2xl font-bold text-slate-900 mb-4">{PRICING.free.priceLabel}</div>
              <ul className="space-y-2.5">
                {PRICING.free.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                    <Check size={16} className="text-emerald-500 shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border-2 border-indigo-500 bg-white p-6 relative">
              <div className="absolute -top-3 left-6 px-2.5 py-0.5 rounded-full text-xs font-semibold text-white" style={{ background: BRAND.primaryGradient }}>
                Önerilen
              </div>
              <div className="text-base font-semibold text-slate-800 mb-1">{PRICING.premium_monthly.label}</div>
              <div className="text-2xl font-bold text-slate-900 mb-4">{PRICING.premium_monthly.priceLabel}</div>
              <ul className="space-y-2.5">
                {PRICING.premium_monthly.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                    <Check size={16} className="text-indigo-500 shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FİYAT */}
      <section id="pricing" className="px-4 sm:px-6 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">Kahve fiyatına aylık dijital koç.</h2>
          <p className="text-slate-600 mb-10">Gizli ücret yok. İstediğin zaman iptal edebilirsin.</p>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="text-sm text-slate-500 mb-1">{PRICING.free.label}</div>
              <div className="text-3xl font-bold text-slate-900 mb-1">{PRICING.free.priceLabel}</div>
              <div className="text-xs text-slate-400 mb-5">Süresiz</div>
              <button onClick={() => setAuthView("register")} className="w-full py-2.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200">
                Ücretsiz Başla
              </button>
            </div>
            <div className="rounded-2xl border-2 border-indigo-500 bg-white p-6 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-xs font-semibold text-white" style={{ background: BRAND.primaryGradient }}>
                En Popüler
              </div>
              <div className="text-sm text-slate-500 mb-1">{PRICING.premium_monthly.label}</div>
              <div className="text-3xl font-bold text-slate-900 mb-1">{PRICING.premium_monthly.priceLabel}</div>
              <div className="text-xs text-slate-400 mb-5">Aylık otomatik yenileme</div>
              <button onClick={() => setAuthView("register")} className="w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
                Premium'a Geç
              </button>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="text-sm text-slate-500 mb-1">{PRICING.premium_yearly.label}</div>
              <div className="text-3xl font-bold text-slate-900 mb-1">{PRICING.premium_yearly.priceLabel}</div>
              <div className="text-xs text-emerald-600 mb-5">{PRICING.premium_yearly.badge}</div>
              <button onClick={() => setAuthView("register")} className="w-full py-2.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200">
                Yıllık Al
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="px-4 sm:px-6 py-16 bg-slate-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-10">Sık Sorulan Sorular</h2>
          <div className="space-y-2">
            {FAQ.map((item, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <button onClick={() => toggleFaq(i)} className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50">
                  <span className="font-medium text-slate-800">{item.q}</span>
                  <ChevronDown size={18} className={`text-slate-400 transition ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-slate-600 border-t border-slate-100">
                    <p className="pt-3">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 sm:px-6 py-16" style={{ background: BRAND.primaryGradient }}>
        <div className="max-w-3xl mx-auto text-center text-white">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Bugün çalışmaya başla.</h2>
          <p className="text-white/80 mb-7">İlk denemeni eklediğinde sistemin seni tanımaya başlayacak.</p>
          <button onClick={() => setAuthView("register")} className="px-7 py-3 rounded-lg bg-white text-indigo-700 font-semibold hover:bg-slate-100">
            Ücretsiz Hesap Oluştur
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="px-4 sm:px-6 py-10 border-t border-slate-100">
        <div className="max-w-6xl mx-auto grid sm:grid-cols-3 gap-6 text-sm">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: BRAND.primaryGradient }}>
                <Target className="text-white" size={14} />
              </div>
              <span className="font-bold text-slate-800">{BRAND.shortName}</span>
            </div>
            <p className="text-slate-500">{BRAND.tagline}</p>
          </div>
          <div>
            <div className="font-semibold text-slate-800 mb-2">Ürün</div>
            <ul className="space-y-1 text-slate-500">
              <li><a href="#features" className="hover:text-slate-700">Özellikler</a></li>
              <li><a href="#exams" className="hover:text-slate-700">Sınavlar</a></li>
              <li><a href="#pricing" className="hover:text-slate-700">Fiyat</a></li>
            </ul>
          </div>
          <div>
            <div className="font-semibold text-slate-800 mb-2">Yasal</div>
            <ul className="space-y-1 text-slate-500">
              <li><a href="#" className="hover:text-slate-700">Gizlilik Politikası</a></li>
              <li><a href="#" className="hover:text-slate-700">Kullanım Koşulları</a></li>
              <li><a href="#" className="hover:text-slate-700">KVKK</a></li>
              <li><a href="#" className="hover:text-slate-700">İletişim</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-slate-100 text-xs text-slate-400 text-center">
          © {new Date().getFullYear()} {BRAND.name}. Tüm hakları saklıdır.
        </div>
      </footer>
    </div>
  );
}