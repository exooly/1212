import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";
import {
  Home, BookOpen, ClipboardList, Timer, BarChart3, Target, Settings as SettingsIcon,
  Sun, Moon, Plus, Trash2, X, ChevronLeft, ChevronRight, Flame, TrendingUp, TrendingDown,
  Play, Pause, RotateCcw, Download, Upload, Menu, CalendarDays, CheckCircle2, Circle,
  AlertTriangle, Sparkles, LogOut,
} from "lucide-react";
import { useAuth } from "./useAuth";
import { LoginScreen, RegisterScreen, ForgotPasswordScreen } from "./AuthScreens";
import { supabase, isSupabaseConfigured } from "./lib/supabaseClient";
import { uid, todayStr, addDays, diffDaysFromToday, clamp, fmtMin, fmtNet, calcSubjectNet, calcExamTotalNet, topicSuccessRate, successLevel, computeStreak } from "./lib/helpers";
import { generateCoachInsights, greeting } from "./lib/coaching";
import { BRAND } from "./lib/brand";
import LandingPage from "./LandingPage";

/* ============================== VERİ TANIMLARI ============================== */

const SUBJECTS = [
  { key: "turkce", name: "Türkçe", color: "#4F46E5", topics: [
    "Sözcükte Anlam","Cümlede Anlam","Paragraf","Sözcük Türleri","Fiiller","Cümlenin Ögeleri",
    "Cümle Türleri","Yazım Kuralları","Noktalama İşaretleri","Ses Bilgisi","Anlatım Bozukluğu",
  ]},
  { key: "matematik", name: "Matematik", color: "#7C3AED", topics: [
    "Temel Kavramlar","Sayılar","Bölme-Bölünebilme","EBOB-EKOK","Rasyonel Sayılar","Ondalık Sayılar",
    "Basit Eşitsizlik","Mutlak Değer","Üslü Sayılar","Köklü Sayılar","Oran-Orantı","Problemler",
    "Kümeler","Fonksiyonlar","Permütasyon","Kombinasyon","Olasılık","Veri ve Grafikler","Geometri",
  ]},
  { key: "tarih", name: "Tarih", color: "#0891B2", topics: [
    "İlk Türk Devletleri","Türk-İslam Devletleri","Osmanlı Devleti","Osmanlı Kültür ve Medeniyeti",
    "XX. Yüzyıl Osmanlı","Milli Mücadele","Atatürk İlke ve İnkılapları","Cumhuriyet Dönemi",
    "Çağdaş Türk ve Dünya Tarihi",
  ]},
  { key: "cografya", name: "Coğrafya", color: "#059669", topics: [
    "Türkiye'nin Coğrafi Konumu","İklim","Yer Şekilleri","Nüfus","Göç","Tarım","Hayvancılık",
    "Madenler","Enerji Kaynakları","Sanayi","Ulaşım","Turizm","Bölgeler",
  ]},
  { key: "vatandaslik", name: "Vatandaşlık", color: "#D97706", topics: [
    "Hukukun Temel Kavramları","Anayasa","Temel Hak ve Ödevler","Yasama","Yürütme","Yargı","İdare",
    "Güncel Anayasal Bilgiler",
  ]},
  { key: "guncel", name: "Güncel Bilgiler", color: "#DC2626", topics: [
    "Türkiye'deki Güncel Gelişmeler","Dünyadaki Önemli Gelişmeler","Kurumlar","Önemli Kişiler",
    "Ödüller","Uluslararası Kuruluşlar","Güncel Kültür/Sanat/Spor/Bilim Gelişmeleri",
  ]},
];

const STATUS_OPTS = ["Başlamadım","Çalışıyorum","Tamamlandı","Tekrar Gerekli","Zayıf","Çok İyi"];
const STATUS_COLOR = {
  "Başlamadım": "#94A3B8", "Çalışıyorum": "#0284C7", "Tamamlandı": "#059669",
  "Tekrar Gerekli": "#D97706", "Zayıf": "#DC2626", "Çok İyi": "#7C3AED",
};
const IMPORTANCE_OPTS = ["Düşük","Orta","Yüksek"];

/* ============================== YARDIMCI FONKSİYONLAR ============================== */
// Not: uid, todayStr, addDays, diffDaysFromToday, clamp, fmtMin, fmtNet,
// calcSubjectNet, calcExamTotalNet, topicSuccessRate, successLevel,
// computeStreak artık src/lib/helpers.js'ten import ediliyor.

// Öncelik puanı: %40 başarı, %25 deneme yanlış oranı(dersin son denemesi), %20 son çalışma tarihi, %15 tekrar ihtiyacı
function topicPriority(t, lastExam, divisor) {
  const rate = topicSuccessRate(t);
  const rateFactor = rate == null ? 20 : ((100 - rate) / 100) * 40;

  let examFactor = 0;
  if (lastExam) {
    const r = lastExam.subjects[t.subject];
    if (r) {
      const total = (r.correct || 0) + (r.wrong || 0) + (r.blank || 0);
      const wrongRatio = total > 0 ? (r.wrong || 0) / total : 0;
      examFactor = wrongRatio * 25;
    }
  }

  let recencyFactor = 20;
  if (t.lastStudyDate) {
    const days = clamp(-diffDaysFromToday(t.lastStudyDate), 0, 30);
    recencyFactor = (days / 30) * 20;
  }

  let reviewFactor = 0;
  if (t.nextReviewDate && diffDaysFromToday(t.nextReviewDate) <= 0) reviewFactor = 15;

  return Math.round((rateFactor + examFactor + recencyFactor + reviewFactor) * 10) / 10;
}

function readinessScore(state) {
  const allTopics = Object.values(state.topics);
  const total = allTopics.length || 1;
  const completedCount = allTopics.filter(t => t.status === "Tamamlandı" || t.status === "Çok İyi").length;
  const completion = (completedCount / total) * 100;

  const rates = allTopics.map(topicSuccessRate).filter(r => r != null);
  const avgRate = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;

  const sortedExams = [...state.exams].sort((a, b) => a.date.localeCompare(b.date));
  const lastNet = sortedExams.length ? calcExamTotalNet(sortedExams[sortedExams.length - 1], state.settings.wrongPenaltyDivisor) : 0;
  const examScore = state.settings.targetNet > 0 ? clamp((lastNet / state.settings.targetNet) * 100, 0, 100) : 0;

  const streak = computeStreak(state.dailyLogs, state.settings.dailyGoalMinutes);
  const disciplineScore = clamp((streak / 14) * 100, 0, 100);

  const reviewables = allTopics.filter(t => t.nextReviewDate);
  const onTrack = reviewables.filter(t => diffDaysFromToday(t.nextReviewDate) > 0).length;
  const reviewScore = reviewables.length ? (onTrack / reviewables.length) * 100 : 100;

  const score = completion * 0.25 + avgRate * 0.25 + examScore * 0.25 + disciplineScore * 0.15 + reviewScore * 0.10;
  return {
    total: Math.round(score),
    breakdown: [
      { label: "Konu Tamamlama", value: Math.round(completion) },
      { label: "Soru Başarı Oranı", value: Math.round(avgRate) },
      { label: "Deneme Performansı", value: Math.round(examScore) },
      { label: "Çalışma Düzeni (Streak)", value: Math.round(disciplineScore) },
      { label: "Tekrar Düzeni", value: Math.round(reviewScore) },
    ],
  };
}

/* ============================== DEMO / VARSAYILAN VERİ ============================== */

function buildDefaultTopics() {
  const topics = {};
  SUBJECTS.forEach(s => {
    s.topics.forEach(name => {
      const id = `${s.key}__${name}`;
      topics[id] = {
        id, subject: s.key, name, status: "Başlamadım", studyCount: 0, lastStudyDate: null,
        correct: 0, wrong: 0, blank: 0, lastReviewDate: null, nextReviewDate: null,
        importance: "Orta", note: "",
      };
    });
  });
  return topics;
}

function seedDemoData(state) {
  const t = { ...state.topics };
  const set = (id, patch) => { if (t[id]) t[id] = { ...t[id], ...patch }; };
  set("matematik__Problemler", { status: "Zayıf", correct: 110, wrong: 90, blank: 0, studyCount: 6, lastStudyDate: addDays(todayStr(), -9), nextReviewDate: addDays(todayStr(), -2), importance: "Yüksek" });
  set("matematik__Üslü Sayılar", { status: "Tekrar Gerekli", correct: 40, wrong: 25, blank: 5, studyCount: 3, lastStudyDate: addDays(todayStr(), -14), nextReviewDate: addDays(todayStr(), -1) });
  set("turkce__Paragraf", { status: "Çok İyi", correct: 125, wrong: 25, blank: 0, studyCount: 8, lastStudyDate: addDays(todayStr(), -2), nextReviewDate: addDays(todayStr(), 10) });
  set("turkce__Anlatım Bozukluğu", { status: "Çalışıyorum", correct: 60, wrong: 20, blank: 5, studyCount: 4, lastStudyDate: addDays(todayStr(), -4) });
  set("tarih__Milli Mücadele", { status: "Tekrar Gerekli", correct: 30, wrong: 18, blank: 2, studyCount: 3, lastStudyDate: addDays(todayStr(), -12), nextReviewDate: addDays(todayStr(), -3) });
  set("cografya__İklim", { status: "Çok İyi", correct: 48, wrong: 4, blank: 0, studyCount: 5, lastStudyDate: addDays(todayStr(), -1) });
  set("vatandaslik__Anayasa", { status: "Çalışıyorum", correct: 30, wrong: 18, blank: 2, studyCount: 3, lastStudyDate: addDays(todayStr(), -6) });
  set("guncel__Kurumlar", { status: "Başlamadım" });

  const exams = [
    { id: uid(), name: "Deneme 1", date: addDays(todayStr(), -35), subjects: {
      turkce: { correct: 30, wrong: 8, blank: 2 }, matematik: { correct: 12, wrong: 15, blank: 3 },
      tarih: { correct: 5, wrong: 4, blank: 0 }, cografya: { correct: 8, wrong: 4, blank: 1 },
      vatandaslik: { correct: 3, wrong: 3, blank: 0 }, guncel: { correct: 2, wrong: 3, blank: 0 },
    }},
    { id: uid(), name: "Deneme 2", date: addDays(todayStr(), -21), subjects: {
      turkce: { correct: 32, wrong: 6, blank: 2 }, matematik: { correct: 14, wrong: 14, blank: 2 },
      tarih: { correct: 6, wrong: 3, blank: 0 }, cografya: { correct: 9, wrong: 3, blank: 1 },
      vatandaslik: { correct: 4, wrong: 2, blank: 0 }, guncel: { correct: 2, wrong: 2, blank: 1 },
    }},
    { id: uid(), name: "Deneme 3", date: addDays(todayStr(), -7), subjects: {
      turkce: { correct: 34, wrong: 5, blank: 1 }, matematik: { correct: 16, wrong: 13, blank: 1 },
      tarih: { correct: 6, wrong: 2, blank: 1 }, cografya: { correct: 10, wrong: 2, blank: 1 },
      vatandaslik: { correct: 5, wrong: 1, blank: 0 }, guncel: { correct: 3, wrong: 2, blank: 0 },
    }},
  ];

  const dailyLogs = { ...state.dailyLogs };
  for (let i = 1; i <= 10; i++) {
    const d = addDays(todayStr(), -i);
    if (i % 4 !== 0) dailyLogs[d] = { minutes: 120 + (i * 13) % 150, tasks: [] };
  }

  return { ...state, topics: t, exams, dailyLogs };
}

function defaultState() {
  const base = {
    settings: {
      examDate: addDays(todayStr(), 180),
      targetScore: 90,
      targetNet: 85,
      dailyGoalMinutes: 300,
      weeklyGoalMinutes: 1800,
      wrongPenaltyDivisor: 4,
      theme: "light",
      onboarded: false,
      demoSeeded: false,
    },
    topics: buildDefaultTopics(),
    exams: [],
    dailyLogs: {},
  };
  return base;
}

/* ============================== STORAGE HOOK ============================== */

const STORAGE_KEY = "kpss-koc-state-v1";

function loadLocalState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaultState(), ...parsed, topics: { ...buildDefaultTopics(), ...(parsed.topics || {}) } };
    }
  } catch (e) {
    // bozuk veri / ilk açılış
  }
  return defaultState();
}

function mergeCloudState(parsed) {
  return { ...defaultState(), ...parsed, topics: { ...buildDefaultTopics(), ...(parsed.topics || {}) } };
}

/**
 * Veriler önce localStorage'a (hızlı, offline yedek), kullanıcı giriş yapmışsa
 * ayrıca Supabase'deki "user_states" tablosuna kaydedilir. Böylece aynı hesapla
 * girilen her cihazda aynı veriler görünür. userId yoksa (giriş yapılmamışsa)
 * sistem eskisi gibi sadece localStorage ile çalışır.
 */
function useKpssState(userId) {
  const [state, setState] = useState(() => loadLocalState());
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef(null);
  const readyForUser = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!userId || !isSupabaseConfigured) {
        readyForUser.current = null;
        setState(loadLocalState());
        setLoaded(true);
        return;
      }

      setLoaded(false);
      try {
        const { data, error } = await supabase
          .from("user_states")
          .select("data")
          .eq("user_id", userId)
          .maybeSingle();

        if (cancelled) return;

        if (!error && data && data.data) {
          setState(mergeCloudState(data.data));
        } else {
          // Bulutta henüz veri yok: mevcut cihazdaki (localStorage) veriyi ilk kayıt olarak yükle.
          const local = loadLocalState();
          await supabase.from("user_states").upsert({ user_id: userId, data: local });
          if (!cancelled) setState(local);
        }
      } catch (e) {
        // Bağlantı sorunu olursa yerel veriyle devam et.
        if (!cancelled) setState(loadLocalState());
      }
      if (!cancelled) {
        readyForUser.current = userId;
        setLoaded(true);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) { /* yoksay (örn. depolama dolu) */ }

      if (userId && isSupabaseConfigured && readyForUser.current === userId) {
        try {
          await supabase.from("user_states").upsert({
            user_id: userId,
            data: state,
            updated_at: new Date().toISOString(),
          });
        } catch (e) { /* yoksay (örn. internet kesintisi) */ }
      }
    }, 500);
    return () => clearTimeout(saveTimer.current);
  }, [state, userId, loaded]);

  return [state, setState, loaded];
}

/* ============================== KÜÇÜK UI PARÇALARI ============================== */

function Card({ children, className = "" }) {
  return <div className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm ${className}`}>{children}</div>;
}
function Badge({ color, children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: color + "20", color }}>
      {children}
    </span>
  );
}
function ProgressBar({ value, max = 100, color = "#4F46E5", height = 8 }) {
  const pct = clamp((value / (max || 1)) * 100, 0, 100);
  return (
    <div className="w-full rounded-full bg-slate-100 dark:bg-slate-800" style={{ height }}>
      <div className="rounded-full transition-all" style={{ width: `${pct}%`, height, backgroundColor: color }} />
    </div>
  );
}
function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div
        className={`bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-xl w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-md"} max-h-[90vh] overflow-y-auto`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  );
}
const inputCls = "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-400";

/* ============================== COUNTDOWN ============================== */

function useCountdown(examDate) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const target = new Date(examDate + "T09:00:00").getTime();
  let diff = target - now;
  if (diff < 0) diff = 0;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return { days, hours, mins, secs, total: diff };
}

function CountdownBanner({ examDate }) {
  const { days, hours, mins, secs } = useCountdown(examDate);
  let alert = null;
  if (days <= 7) alert = { text: "Son hafta! Artık sadece tekrar ve deneme yap, yeni konuya girme.", color: "#DC2626" };
  else if (days <= 30) alert = { text: "Son 30 gün! Artık konu öğrenmekten çok eksik kapatma ve deneme dönemine geç.", color: "#D97706" };
  else if (days <= 100) alert = { text: "Son 100 gün! Zayıf konularını netleştirme zamanı.", color: "#0284C7" };

  const units = [
    { v: days, l: "GÜN" }, { v: hours, l: "SAAT" }, { v: mins, l: "DAKİKA" }, { v: secs, l: "SANİYE" },
  ];

  return (
    <div className="rounded-2xl p-6 text-white shadow-lg" style={{ background: "linear-gradient(135deg,#4338CA,#7C3AED)" }}>
      <div className="text-sm font-medium text-indigo-100 mb-3">Sınava Kalan Süre</div>
      <div className="grid grid-cols-4 gap-2 sm:gap-4">
        {units.map(u => (
          <div key={u.l} className="text-center">
            <div className="text-3xl sm:text-5xl font-bold tabular-nums tracking-tight">{u.v}</div>
            <div className="text-[10px] sm:text-xs mt-1 text-indigo-100 tracking-wider">{u.l}</div>
          </div>
        ))}
      </div>
      {alert && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-white/15 px-3 py-2 text-sm">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{alert.text}</span>
        </div>
      )}
    </div>
  );
}

/* ============================== ANALİZ / ÖNERİ MOTORU ============================== */

function usePriorityList(state) {
  return useMemo(() => {
    const sortedExams = [...state.exams].sort((a, b) => a.date.localeCompare(b.date));
    const lastExam = sortedExams[sortedExams.length - 1] || null;
    const list = Object.values(state.topics).map(t => ({
      ...t, priority: topicPriority(t, lastExam, state.settings.wrongPenaltyDivisor), rate: topicSuccessRate(t),
    }));
    list.sort((a, b) => b.priority - a.priority);
    return list;
  }, [state.topics, state.exams, state.settings.wrongPenaltyDivisor]);
}

function subjectName(key) { return SUBJECTS.find(s => s.key === key)?.name || key; }
function subjectColor(key) { return SUBJECTS.find(s => s.key === key)?.color || "#64748B"; }

/* ============================== DASHBOARD ============================== */

function Dashboard({ state, setState, go }) {
  const priorityList = usePriorityList(state);
  const today = todayStr();
  const todayLog = state.dailyLogs[today] || { minutes: 0, tasks: [] };
  const weekMinutes = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < 7; i++) sum += (state.dailyLogs[addDays(today, -i)]?.minutes || 0);
    return sum;
  }, [state.dailyLogs, today]);
  const prevWeekMinutes = useMemo(() => {
    let sum = 0;
    for (let i = 7; i < 14; i++) sum += (state.dailyLogs[addDays(today, -i)]?.minutes || 0);
    return sum;
  }, [state.dailyLogs, today]);

  const sortedExams = [...state.exams].sort((a, b) => a.date.localeCompare(b.date));
  const lastExam = sortedExams[sortedExams.length - 1];
  const prevExam = sortedExams[sortedExams.length - 2];
  const lastNet = lastExam ? calcExamTotalNet(lastExam, state.settings.wrongPenaltyDivisor) : null;
  const prevNet = prevExam ? calcExamTotalNet(prevExam, state.settings.wrongPenaltyDivisor) : null;
  const avgNet = sortedExams.length ? sortedExams.reduce((a, e) => a + calcExamTotalNet(e, state.settings.wrongPenaltyDivisor), 0) / sortedExams.length : null;

  const subjectAvgRates = SUBJECTS.map(s => {
    const topics = Object.values(state.topics).filter(t => t.subject === s.key);
    const rates = topics.map(topicSuccessRate).filter(r => r != null);
    const avg = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
    return { ...s, avg };
  }).filter(s => s.avg != null);
  const strongest = subjectAvgRates.length ? subjectAvgRates.reduce((a, b) => (a.avg > b.avg ? a : b)) : null;
  const weakest = subjectAvgRates.length ? subjectAvgRates.reduce((a, b) => (a.avg < b.avg ? a : b)) : null;

  const streak = computeStreak(state.dailyLogs, state.settings.dailyGoalMinutes);
  const readiness = readinessScore(state);
  const top3 = priorityList.slice(0, 3);

  const subjectNameMap = useMemo(
    () => Object.fromEntries(SUBJECTS.map((s) => [s.key, s.name])),
    []
  );
  const coach = useMemo(
    () =>
      generateCoachInsights({
        exams: state.exams,
        topics: state.topics,
        dailyLogs: state.dailyLogs,
        settings: state.settings,
        examName: "sınavına",
        subjectNameMap,
      }),
    [state.exams, state.topics, state.dailyLogs, state.settings, subjectNameMap]
  );

  return (
    <div className="space-y-5">
      <CountdownBanner examDate={state.settings.examDate} />

      <Card className="p-5 border-l-4" style={{ borderLeftColor: "#4338CA" }}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
            <Sparkles className="text-indigo-600 dark:text-indigo-400" size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-500 mb-0.5">Koçun diyor ki · {greeting()}</div>
            <div className="font-semibold text-slate-800 dark:text-slate-100 mb-2">{coach.headline}</div>
            {coach.empty ? (
              <p className="text-sm text-slate-500">
                İlk verilerini eklediğinde (deneme, çalışma kaydı) burada kişisel öneriler belirecek.
              </p>
            ) : (
              <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1.5">
                {coach.insights.map((line, i) => (
                  <li key={i} className="flex gap-2"><span className="text-indigo-500">•</span><span>{line}</span></li>
                ))}
              </ul>
            )}
            {coach.actions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {coach.actions.map((a, i) => (
                  <button key={i} onClick={() => go(a.type === "start_pomodoro" ? "plan" : "topics")}
                    className="text-xs px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 font-medium hover:bg-indigo-100">
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Bugünkü Çalışma" main={fmtMin(todayLog.minutes)} sub={`Hedef: ${fmtMin(state.settings.dailyGoalMinutes)}`}>
          <ProgressBar value={todayLog.minutes} max={state.settings.dailyGoalMinutes} color="#4F46E5" />
        </StatCard>
        <StatCard title="Haftalık Çalışma" main={fmtMin(weekMinutes)} sub={`Hedef: ${fmtMin(state.settings.weeklyGoalMinutes)}`}>
          <ProgressBar value={weekMinutes} max={state.settings.weeklyGoalMinutes} color="#0891B2" />
          <div className={`text-xs mt-1 flex items-center gap-1 ${weekMinutes >= prevWeekMinutes ? "text-emerald-600" : "text-rose-600"}`}>
            {weekMinutes >= prevWeekMinutes ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            Geçen haftaya göre {fmtMin(Math.abs(weekMinutes - prevWeekMinutes))}
          </div>
        </StatCard>
        <StatCard title="Güncel Net" main={lastNet != null ? fmtNet(lastNet) : "—"} sub={lastExam ? lastExam.name : "Henüz deneme yok"}>
          {prevNet != null && lastNet != null && (
            <div className={`text-xs flex items-center gap-1 ${lastNet >= prevNet ? "text-emerald-600" : "text-rose-600"}`}>
              {lastNet >= prevNet ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {fmtNet(lastNet - prevNet)} net
            </div>
          )}
        </StatCard>
        <StatCard title="Ortalama Net" main={avgNet != null ? fmtNet(avgNet) : "—"} sub={`${sortedExams.length} deneme`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2"><Sparkles size={18} className="text-indigo-500" /> Bugün Ne Çalışmalıyım?</h3>
            <button onClick={() => go("plan")} className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline">Plana git →</button>
          </div>
          {top3.length === 0 || top3.every(t => t.priority === 0) ? (
            <p className="text-sm text-slate-500">Henüz yeterli veri yok, birkaç konu/deneme girdikçe öneriler burada belirecek.</p>
          ) : (
            <div className="space-y-2">
              {top3.map((t, i) => (
                <div key={t.id} className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-800 p-3">
                  <div className="text-lg">{["🥇","🥈","🥉"][i]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{subjectName(t.subject)} — {t.name}</div>
                    <div className="text-xs text-slate-500">{t.rate != null ? `Başarı: %${Math.round(t.rate)}` : "Henüz veri yok"}</div>
                  </div>
                  <Badge color={t.priority > 60 ? "#DC2626" : t.priority > 35 ? "#D97706" : "#0284C7"}>
                    {t.priority > 60 ? "Çok Yüksek" : t.priority > 35 ? "Yüksek" : "Orta"} öncelik
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Hazırlık Skoru</h3>
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 shrink-0">
              <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                <circle cx="18" cy="18" r="16" fill="none" stroke="#E2E8F0" strokeWidth="4" />
                <circle cx="18" cy="18" r="16" fill="none" stroke="#4F46E5" strokeWidth="4"
                  strokeDasharray={`${readiness.total} 100`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-slate-800 dark:text-slate-100">{readiness.total}</div>
            </div>
            <div className="flex-1 space-y-1.5">
              {readiness.breakdown.map(b => (
                <div key={b.label} className="text-[11px] text-slate-500">
                  <div className="flex justify-between"><span>{b.label}</span><span>{b.value}</span></div>
                  <ProgressBar value={b.value} height={4} color="#7C3AED" />
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="text-xs text-slate-500 mb-1">En Güçlü Ders</div>
          {strongest ? (
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: strongest.color }} />
              <div className="font-semibold text-slate-800 dark:text-slate-100">{strongest.name}</div>
              <span className="text-emerald-600 text-sm">%{Math.round(strongest.avg)}</span>
            </div>
          ) : <div className="text-sm text-slate-400">Veri yok</div>}
        </Card>
        <Card className="p-5">
          <div className="text-xs text-slate-500 mb-1">En Zayıf Ders</div>
          {weakest ? (
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: weakest.color }} />
              <div className="font-semibold text-slate-800 dark:text-slate-100">{weakest.name}</div>
              <span className="text-rose-600 text-sm">%{Math.round(weakest.avg)}</span>
            </div>
          ) : <div className="text-sm text-slate-400">Veri yok</div>}
        </Card>
        <Card className="p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center"><Flame className="text-orange-500" size={20} /></div>
          <div>
            <div className="text-xs text-slate-500">Çalışma Serisi</div>
            <div className="font-semibold text-slate-800 dark:text-slate-100">{streak} Günlük Seri</div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, main, sub, children }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="text-xs text-slate-500 mb-1">{title}</div>
      <div className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">{main}</div>
      {sub && <div className="text-xs text-slate-400 mb-1">{sub}</div>}
      {children}
    </Card>
  );
}

/* ============================== KONULAR / DERSLER ============================== */

function TopicsPage({ state, setState }) {
  const [activeSubject, setActiveSubject] = useState(SUBJECTS[0].key);
  const [editingTopic, setEditingTopic] = useState(null);

  const topics = Object.values(state.topics).filter(t => t.subject === activeSubject);
  const sortedExams = [...state.exams].sort((a, b) => a.date.localeCompare(b.date));
  const lastExam = sortedExams[sortedExams.length - 1] || null;

  const saveTopic = (patch) => {
    setState(s => ({ ...s, topics: { ...s.topics, [editingTopic.id]: { ...s.topics[editingTopic.id], ...patch } } }));
    setEditingTopic(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {SUBJECTS.map(s => (
          <button key={s.key} onClick={() => setActiveSubject(s.key)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium border transition ${activeSubject === s.key ? "text-white border-transparent" : "text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"}`}
            style={activeSubject === s.key ? { backgroundColor: s.color } : {}}>
            {s.name}
          </button>
        ))}
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800">
              <th className="px-4 py-3">Konu</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3">Başarı</th>
              <th className="px-4 py-3">Son Çalışma</th>
              <th className="px-4 py-3">Öncelik</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {topics.map(t => {
              const rate = topicSuccessRate(t);
              const lvl = successLevel(rate);
              const prio = topicPriority(t, lastExam, state.settings.wrongPenaltyDivisor);
              const overdue = t.nextReviewDate && diffDaysFromToday(t.nextReviewDate) <= 0;
              return (
                <tr key={t.id} className="border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer" onClick={() => setEditingTopic(t)}>
                  <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">
                    {t.name}
                    {overdue && <span className="ml-2"><Badge color="#DC2626">Tekrar Zamanı</Badge></span>}
                  </td>
                  <td className="px-4 py-3"><Badge color={STATUS_COLOR[t.status]}>{t.status}</Badge></td>
                  <td className="px-4 py-3">
                    {rate != null ? (
                      <span style={{ color: lvl.color }} className="font-medium">%{Math.round(rate)} <span className="text-slate-400 font-normal">({lvl.label})</span></span>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{t.lastStudyDate ? `${-diffDaysFromToday(t.lastStudyDate)} gün önce` : "Hiç"}</td>
                  <td className="px-4 py-3"><ProgressBar value={prio} max={100} height={6} color={prio > 60 ? "#DC2626" : prio > 35 ? "#D97706" : "#0284C7"} /></td>
                  <td className="px-4 py-3 text-indigo-500 text-xs font-medium">Düzenle</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {editingTopic && (
        <TopicEditModal topic={editingTopic} onClose={() => setEditingTopic(null)} onSave={saveTopic}
          onStudiedToday={() => saveTopic({ lastStudyDate: todayStr(), studyCount: (editingTopic.studyCount || 0) + 1 })} />
      )}
    </div>
  );
}

function TopicEditModal({ topic, onClose, onSave, onStudiedToday }) {
  const [f, setF] = useState({ ...topic });
  const total = (Number(f.correct) || 0) + (Number(f.wrong) || 0) + (Number(f.blank) || 0);
  return (
    <Modal title={topic.name} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Durum">
          <select className={inputCls} value={f.status} onChange={e => setF({ ...f, status: e.target.value })}>
            {STATUS_OPTS.map(o => <option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Önem">
          <select className={inputCls} value={f.importance} onChange={e => setF({ ...f, importance: e.target.value })}>
            {IMPORTANCE_OPTS.map(o => <option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Doğru"><input type="number" min="0" className={inputCls} value={f.correct} onChange={e => setF({ ...f, correct: Math.max(0, +e.target.value) })} /></Field>
        <Field label="Yanlış"><input type="number" min="0" className={inputCls} value={f.wrong} onChange={e => setF({ ...f, wrong: Math.max(0, +e.target.value) })} /></Field>
        <Field label="Boş"><input type="number" min="0" className={inputCls} value={f.blank} onChange={e => setF({ ...f, blank: Math.max(0, +e.target.value) })} /></Field>
        <Field label="Çözülen Soru (otomatik)"><input disabled className={inputCls + " opacity-60"} value={total} /></Field>
        <Field label="Son Tekrar Tarihi"><input type="date" className={inputCls} value={f.lastReviewDate || ""} onChange={e => setF({ ...f, lastReviewDate: e.target.value })} /></Field>
        <Field label="Sonraki Tekrar Tarihi"><input type="date" className={inputCls} value={f.nextReviewDate || ""} onChange={e => setF({ ...f, nextReviewDate: e.target.value })} /></Field>
      </div>
      <Field label="Kişisel Değerlendirme"><textarea className={inputCls} rows={2} value={f.note} onChange={e => setF({ ...f, note: e.target.value })} /></Field>
      <div className="flex flex-wrap gap-2 mt-4">
        <button onClick={onStudiedToday} className="px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 text-sm font-medium hover:bg-indigo-100">Bugün Çalıştım ✓</button>
        <div className="flex-1" />
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-500">Vazgeç</button>
        <button onClick={() => onSave(f)} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">Kaydet</button>
      </div>
    </Modal>
  );
}

/* ============================== DENEMELER + NET GRAFİĞİ ============================== */

function ExamsPage({ state, setState }) {
  const [tab, setTab] = useState("liste");
  const [showAdd, setShowAdd] = useState(false);
  const [editExam, setEditExam] = useState(null);
  const divisor = state.settings.wrongPenaltyDivisor;

  const sortedExams = [...state.exams].sort((a, b) => a.date.localeCompare(b.date));

  const removeExam = (id) => setState(s => ({ ...s, exams: s.exams.filter(e => e.id !== id) }));

  const saveExam = (exam) => {
    setState(s => {
      const exists = s.exams.some(e => e.id === exam.id);
      return { ...s, exams: exists ? s.exams.map(e => e.id === exam.id ? exam : e) : [...s.exams, exam] };
    });
    setShowAdd(false); setEditExam(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          <button onClick={() => setTab("liste")} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === "liste" ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}>Liste</button>
          <button onClick={() => setTab("grafik")} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === "grafik" ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}>Net Grafiği</button>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"><Plus size={16} /> Deneme Ekle</button>
      </div>

      {tab === "liste" ? (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3">Deneme</th><th className="px-4 py-3">Tarih</th><th className="px-4 py-3">Net</th><th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {sortedExams.slice().reverse().map(ex => (
                <tr key={ex.id} className="border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200 cursor-pointer" onClick={() => setEditExam(ex)}>{ex.name}</td>
                  <td className="px-4 py-3 text-slate-500">{ex.date}</td>
                  <td className="px-4 py-3 font-semibold text-indigo-600 dark:text-indigo-400">{fmtNet(calcExamTotalNet(ex, divisor))}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => removeExam(ex.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
              {sortedExams.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Henüz deneme eklenmedi.</td></tr>}
            </tbody>
          </table>
        </Card>
      ) : (
        <NetChart exams={sortedExams} divisor={divisor} />
      )}

      {(showAdd || editExam) && (
        <ExamModal exam={editExam} onClose={() => { setShowAdd(false); setEditExam(null); }} onSave={saveExam} divisor={divisor} />
      )}
    </div>
  );
}

function ExamModal({ exam, onClose, onSave, divisor }) {
  const [f, setF] = useState(exam || { id: uid(), name: `Deneme ${1}`, date: todayStr(), subjects: Object.fromEntries(SUBJECTS.map(s => [s.key, { correct: 0, wrong: 0, blank: 0 }])) });
  const totalNet = calcExamTotalNet(f, divisor);
  const setSub = (key, field, val) => setF({ ...f, subjects: { ...f.subjects, [key]: { ...f.subjects[key], [field]: Math.max(0, +val) } } });

  return (
    <Modal title={exam ? "Denemeyi Düzenle" : "Yeni Deneme Ekle"} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Deneme Adı"><input className={inputCls} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Tarih"><input type="date" className={inputCls} value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
      </div>
      <div className="mt-2 space-y-3">
        {SUBJECTS.map(s => {
          const r = f.subjects[s.key] || { correct: 0, wrong: 0, blank: 0 };
          return (
            <div key={s.key} className="rounded-xl border border-slate-100 dark:border-slate-800 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} /> {s.name}
                </div>
                <span className="text-xs text-slate-500">Net: {fmtNet(calcSubjectNet(r, divisor))}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input type="number" min="0" className={inputCls} placeholder="Doğru" value={r.correct} onChange={e => setSub(s.key, "correct", e.target.value)} />
                <input type="number" min="0" className={inputCls} placeholder="Yanlış" value={r.wrong} onChange={e => setSub(s.key, "wrong", e.target.value)} />
                <input type="number" min="0" className={inputCls} placeholder="Boş" value={r.blank} onChange={e => setSub(s.key, "blank", e.target.value)} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-slate-600 dark:text-slate-300">Toplam Net: <span className="font-bold text-indigo-600 dark:text-indigo-400">{fmtNet(totalNet)}</span></div>
        <div className="flex gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-500">Vazgeç</button>
          <button onClick={() => onSave(f)} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">Kaydet</button>
        </div>
      </div>
    </Modal>
  );
}

function NetChart({ exams, divisor }) {
  const [subject, setSubject] = useState("toplam");
  const data = exams.map(ex => {
    const row = { name: ex.name };
    row.toplam = Math.round(calcExamTotalNet(ex, divisor) * 100) / 100;
    SUBJECTS.forEach(s => { row[s.key] = Math.round(calcSubjectNet(ex.subjects[s.key], divisor) * 100) / 100; });
    return row;
  });
  const color = subject === "toplam" ? "#4F46E5" : subjectColor(subject);
  const label = subject === "toplam" ? "Toplam Net" : subjectName(subject);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">Net Değişim Grafiği</h3>
        <select className={inputCls + " w-auto"} value={subject} onChange={e => setSubject(e.target.value)}>
          <option value="toplam">Toplam Net</option>
          {SUBJECTS.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
        </select>
      </div>
      {data.length === 0 ? <p className="text-sm text-slate-400 py-8 text-center">Grafik için en az bir deneme ekleyin.</p> : (
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey={subject} name={label} stroke={color} strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

/* ============================== ÇALIŞMA PLANI + POMODORO ============================== */

function PlanPage({ state, setState }) {
  const priorityList = usePriorityList(state);
  const today = todayStr();
  const todayLog = state.dailyLogs[today] || { minutes: 0, tasks: [] };
  const [showAddTask, setShowAddTask] = useState(false);

  const updateLog = (patch) => setState(s => ({ ...s, dailyLogs: { ...s.dailyLogs, [today]: { ...(s.dailyLogs[today] || { minutes: 0, tasks: [] }), ...patch } } }));

  const generatePlan = () => {
    const top3 = priorityList.slice(0, 3);
    const goal = state.settings.dailyGoalMinutes;
    const splits = [0.4, 0.35, 0.25];
    const tasks = top3.map((t, i) => ({
      id: uid(), topicId: t.id, subject: t.subject, topic: t.name, duration: Math.round(goal * splits[i]), done: false,
    }));
    updateLog({ tasks: [...(todayLog.tasks || []), ...tasks] });
  };

  const toggleTask = (taskId) => {
    const tasks = todayLog.tasks.map(tk => tk.id === taskId ? { ...tk, done: !tk.done } : tk);
    const task = todayLog.tasks.find(tk => tk.id === taskId);
    const delta = task.done ? -task.duration : task.duration;
    updateLog({ tasks, minutes: Math.max(0, (todayLog.minutes || 0) + delta) });
    if (!task.done && task.topicId && state.topics[task.topicId]) {
      setState(s => ({ ...s, topics: { ...s.topics, [task.topicId]: { ...s.topics[task.topicId], lastStudyDate: today, studyCount: (s.topics[task.topicId].studyCount || 0) + 1 } } }));
    }
  };

  const removeTask = (taskId) => {
    const task = todayLog.tasks.find(tk => tk.id === taskId);
    const tasks = todayLog.tasks.filter(tk => tk.id !== taskId);
    const delta = task && task.done ? -task.duration : 0;
    updateLog({ tasks, minutes: Math.max(0, (todayLog.minutes || 0) + delta) });
  };

  return (
    <div className="space-y-4">
      <PomodoroCard onAddMinutes={(m) => updateLog({ minutes: (todayLog.minutes || 0) + m })} />

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Bugünkü Çalışma Planı</h3>
          <div className="flex gap-2">
            <button onClick={generatePlan} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 text-sm font-medium hover:bg-indigo-100"><Sparkles size={14} /> Öncelikli Konuları Ekle</button>
            <button onClick={() => setShowAddTask(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-medium"><Plus size={14} /> Görev Ekle</button>
          </div>
        </div>
        <div className="space-y-2">
          {(todayLog.tasks || []).length === 0 && <p className="text-sm text-slate-400 py-4 text-center">Bugün için henüz görev yok. "Öncelikli Konuları Ekle" ile başlayabilirsin.</p>}
          {(todayLog.tasks || []).map(tk => (
            <div key={tk.id} className={`flex items-center gap-3 rounded-xl border p-3 ${tk.done ? "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/10 dark:border-emerald-900" : "border-slate-100 dark:border-slate-800"}`}>
              <button onClick={() => toggleTask(tk.id)}>{tk.done ? <CheckCircle2 className="text-emerald-500" size={22} /> : <Circle className="text-slate-300" size={22} />}</button>
              <div className="flex-1">
                <div className={`text-sm font-medium ${tk.done ? "line-through text-slate-400" : "text-slate-700 dark:text-slate-200"}`}>{subjectName(tk.subject)} — {tk.topic}</div>
                <div className="text-xs text-slate-400">{fmtMin(tk.duration)}{tk.time ? ` · ${tk.time}` : ""}</div>
              </div>
              <button onClick={() => removeTask(tk.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      </Card>

      {showAddTask && <AddTaskModal state={state} onClose={() => setShowAddTask(false)} onAdd={(task) => { updateLog({ tasks: [...(todayLog.tasks || []), task] }); setShowAddTask(false); }} />}
    </div>
  );
}

function AddTaskModal({ state, onClose, onAdd }) {
  const [subject, setSubject] = useState(SUBJECTS[0].key);
  const topics = Object.values(state.topics).filter(t => t.subject === subject);
  const [topicId, setTopicId] = useState(topics[0]?.id || "");
  const [duration, setDuration] = useState(60);
  const [time, setTime] = useState("");

  useEffect(() => { const ts = Object.values(state.topics).filter(t => t.subject === subject); setTopicId(ts[0]?.id || ""); }, [subject]);

  return (
    <Modal title="Görev Ekle" onClose={onClose}>
      <Field label="Ders">
        <select className={inputCls} value={subject} onChange={e => setSubject(e.target.value)}>
          {SUBJECTS.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
        </select>
      </Field>
      <Field label="Konu">
        <select className={inputCls} value={topicId} onChange={e => setTopicId(e.target.value)}>
          {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Süre (dakika)"><input type="number" min="5" className={inputCls} value={duration} onChange={e => setDuration(+e.target.value)} /></Field>
        <Field label="Saat (opsiyonel)"><input type="time" className={inputCls} value={time} onChange={e => setTime(e.target.value)} /></Field>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-500">Vazgeç</button>
        <button onClick={() => { const t = state.topics[topicId]; onAdd({ id: uid(), topicId, subject, topic: t?.name || "", duration, time, done: false }); }} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium">Ekle</button>
      </div>
    </Modal>
  );
}

function PomodoroCard({ onAddMinutes }) {
  const [preset, setPreset] = useState(25);
  const [breakLen, setBreakLen] = useState(5);
  const [mode, setMode] = useState("work");
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) {
            if (mode === "work") { onAddMinutes(preset); setMode("break"); return breakLen * 60; }
            else { setMode("work"); return preset * 60; }
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, mode, preset, breakLen, onAddMinutes]);

  const reset = () => { setRunning(false); setMode("work"); setSecondsLeft(preset * 60); };
  const applyPreset = (w, b) => { setPreset(w); setBreakLen(b); setMode("work"); setSecondsLeft(w * 60); setRunning(false); };
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <Card className="p-5">
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="text-center">
          <div className={`text-5xl font-bold tabular-nums ${mode === "work" ? "text-indigo-600 dark:text-indigo-400" : "text-emerald-600 dark:text-emerald-400"}`}>{mm}:{ss}</div>
          <div className="text-xs text-slate-400 mt-1">{mode === "work" ? "Çalışma Zamanı" : "Mola Zamanı"}</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setRunning(r => !r)} className="w-11 h-11 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700">{running ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}</button>
          <button onClick={reset} className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center"><RotateCcw size={16} /></button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => applyPreset(25, 5)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${preset === 25 ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>25/5</button>
          <button onClick={() => applyPreset(50, 10)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${preset === 50 ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>50/10</button>
          <button onClick={() => onAddMinutes(15)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500">+15 dk elle ekle</button>
        </div>
      </div>
    </Card>
  );
}

/* ============================== TAKVİM ============================== */

function CalendarPage({ state }) {
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState(null);
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Pazartesi başlangıç
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const goal = state.settings.dailyGoalMinutes;

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const intensity = (mins) => {
    if (!mins) return "bg-slate-50 dark:bg-slate-800/50";
    const pct = mins / goal;
    if (pct >= 1) return "bg-indigo-600 text-white";
    if (pct >= 0.6) return "bg-indigo-400 text-white";
    if (pct >= 0.3) return "bg-indigo-200 dark:bg-indigo-900";
    return "bg-indigo-100 dark:bg-indigo-950";
  };

  const dateStr = (d) => `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronLeft size={18} /></button>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">{cursor.toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}</h3>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronRight size={18} /></button>
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-slate-400 mb-1">
          {["Pt","Sa","Ça","Pe","Cu","Ct","Pz"].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const ds = dateStr(d);
            const mins = state.dailyLogs[ds]?.minutes || 0;
            const isExamDay = state.exams.some(e => e.date === ds);
            return (
              <button key={i} onClick={() => setSelected(ds)} className={`aspect-square rounded-lg text-xs font-medium flex flex-col items-center justify-center relative ${intensity(mins)} ${ds === todayStr() ? "ring-2 ring-indigo-500" : ""}`}>
                {d}
                {isExamDay && <span className="absolute bottom-0.5 w-1.5 h-1.5 rounded-full bg-rose-500" />}
              </button>
            );
          })}
        </div>
      </Card>
      {selected && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-slate-700 dark:text-slate-200">{selected}</h4>
            <button onClick={() => setSelected(null)} className="text-slate-400"><X size={16} /></button>
          </div>
          <p className="text-sm text-slate-500">Çalışma: {fmtMin(state.dailyLogs[selected]?.minutes || 0)}</p>
          <div className="mt-2 space-y-1">
            {(state.dailyLogs[selected]?.tasks || []).map(tk => (
              <div key={tk.id} className="text-xs text-slate-500 flex items-center gap-1">
                {tk.done ? <CheckCircle2 size={12} className="text-emerald-500" /> : <Circle size={12} className="text-slate-300" />}
                {subjectName(tk.subject)} — {tk.topic}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ============================== İSTATİSTİKLER ============================== */

function StatsPage({ state }) {
  const divisor = state.settings.wrongPenaltyDivisor;
  const exams = [...state.exams].sort((a, b) => a.date.localeCompare(b.date));
  const nets = exams.map(e => calcExamTotalNet(e, divisor));
  const totalMinutes = Object.values(state.dailyLogs).reduce((a, l) => a + (l.minutes || 0), 0);
  const totalSolved = Object.values(state.topics).reduce((a, t) => a + (t.correct || 0) + (t.wrong || 0) + (t.blank || 0), 0);
  const totalCorrect = Object.values(state.topics).reduce((a, t) => a + (t.correct || 0), 0);
  const totalWrong = Object.values(state.topics).reduce((a, t) => a + (t.wrong || 0), 0);
  const streak = computeStreak(state.dailyLogs, state.settings.dailyGoalMinutes);

  const subjectStats = SUBJECTS.map(s => {
    const topics = Object.values(state.topics).filter(t => t.subject === s.key);
    const rates = topics.map(topicSuccessRate).filter(r => r != null);
    const avg = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
    return { ...s, avg };
  });

  const today = todayStr();
  let thisWeek = 0, lastWeek = 0;
  for (let i = 0; i < 7; i++) thisWeek += state.dailyLogs[addDays(today, -i)]?.minutes || 0;
  for (let i = 7; i < 14; i++) lastWeek += state.dailyLogs[addDays(today, -i)]?.minutes || 0;
  const weekExams = exams.filter(e => diffDaysFromToday(e.date) >= -7 && diffDaysFromToday(e.date) <= 0);
  const weekAvgNet = weekExams.length ? weekExams.reduce((a, e) => a + calcExamTotalNet(e, divisor), 0) / weekExams.length : null;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Bu Hafta Özeti</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div><div className="text-slate-400 text-xs">Toplam Çalışma</div><div className="font-semibold text-slate-800 dark:text-slate-100">{fmtMin(thisWeek)}</div></div>
          <div><div className="text-slate-400 text-xs">Geçen Haftaya Göre</div><div className={`font-semibold ${thisWeek >= lastWeek ? "text-emerald-600" : "text-rose-600"}`}>{thisWeek >= lastWeek ? "+" : "-"}{fmtMin(Math.abs(thisWeek - lastWeek))}</div></div>
          <div><div className="text-slate-400 text-xs">Bu Hafta Deneme</div><div className="font-semibold text-slate-800 dark:text-slate-100">{weekExams.length}</div></div>
          <div><div className="text-slate-400 text-xs">Bu Hafta Ort. Net</div><div className="font-semibold text-slate-800 dark:text-slate-100">{weekAvgNet != null ? fmtNet(weekAvgNet) : "—"}</div></div>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Toplam Çalışma Süresi" main={fmtMin(totalMinutes)} />
        <StatCard title="Toplam Çözülen Soru" main={totalSolved.toLocaleString("tr-TR")} />
        <StatCard title="Toplam Deneme" main={exams.length} />
        <StatCard title="Doğru/Yanlış Oranı" main={totalWrong > 0 ? (totalCorrect / totalWrong).toFixed(2) : "—"} />
        <StatCard title="En Yüksek Net" main={nets.length ? fmtNet(Math.max(...nets)) : "—"} />
        <StatCard title="En Düşük Net" main={nets.length ? fmtNet(Math.min(...nets)) : "—"} />
        <StatCard title="Ortalama Net" main={nets.length ? fmtNet(nets.reduce((a, b) => a + b, 0) / nets.length) : "—"} />
        <StatCard title="Çalışma Serisi" main={`${streak} gün`} />
      </div>

      <Card className="p-5">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Ders Bazında Başarı</h3>
        <div className="space-y-3">
          {subjectStats.map(s => (
            <div key={s.key}>
              <div className="flex justify-between text-sm mb-1"><span className="text-slate-600 dark:text-slate-300">{s.name}</span><span className="text-slate-400">%{Math.round(s.avg)}</span></div>
              <ProgressBar value={s.avg} color={s.color} />
            </div>
          ))}
        </div>
      </Card>

      {exams.length > 0 && (
        <Card className="p-5">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Ders Bazında Son Deneme Netleri</h3>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={SUBJECTS.map(s => ({ name: s.name, net: Math.round(calcSubjectNet(exams[exams.length - 1].subjects[s.key], divisor) * 100) / 100, color: s.color }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="net" radius={[6, 6, 0, 0]}>
                  {SUBJECTS.map(s => <Cell key={s.key} fill={s.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ============================== HEDEFLER ============================== */

function GoalsPage({ state, setState }) {
  const divisor = state.settings.wrongPenaltyDivisor;
  const exams = [...state.exams].sort((a, b) => a.date.localeCompare(b.date));
  const currentNet = exams.length ? calcExamTotalNet(exams[exams.length - 1], divisor) : 0;
  const currentAvg = exams.length ? exams.reduce((a, e) => a + calcExamTotalNet(e, divisor), 0) / exams.length : 0;
  const gap = state.settings.targetNet - currentNet;

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Net Hedefi</h3>
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-slate-500">Mevcut: <b className="text-slate-800 dark:text-slate-100">{fmtNet(currentNet)}</b></span>
          <span className="text-slate-500">Hedef: <b className="text-slate-800 dark:text-slate-100">{state.settings.targetNet}</b></span>
        </div>
        <ProgressBar value={currentNet} max={state.settings.targetNet} height={12} color="#4F46E5" />
        <div className="mt-2 text-sm">
          {gap > 0 ? <span className="text-amber-600">Hedefe {fmtNet(gap)} net kaldı.</span> : <span className="text-emerald-600">Hedefine ulaştın, tebrikler! 🎉</span>}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Puan Hedefi</h3>
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-slate-500">Ortalama Net Bazlı Tahmini Gidişat</span>
          <span className="text-slate-500">Hedef Puan: <b className="text-slate-800 dark:text-slate-100">{state.settings.targetScore}</b></span>
        </div>
        <ProgressBar value={currentAvg} max={state.settings.targetNet} height={12} color="#7C3AED" />
        <p className="text-xs text-slate-400 mt-2">Not: Gerçek KPSS puanı ÖSYM'nin istatistiksel dönüşüm tablosuna göre belirlenir, bu ilerleme çubuğu yalnızca net bazlı kaba bir göstergedir.</p>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Hedefleri Güncelle</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Hedef Puan"><input type="number" className={inputCls} value={state.settings.targetScore} onChange={e => setState(s => ({ ...s, settings: { ...s.settings, targetScore: +e.target.value } }))} /></Field>
          <Field label="Hedef Net"><input type="number" className={inputCls} value={state.settings.targetNet} onChange={e => setState(s => ({ ...s, settings: { ...s.settings, targetNet: +e.target.value } }))} /></Field>
        </div>
      </Card>
    </div>
  );
}

/* ============================== AYARLAR ============================== */

function SettingsPage({ state, setState }) {
  const s = state.settings;
  const set = (patch) => setState(st => ({ ...st, settings: { ...st.settings, ...patch } }));
  const fileInputRef = useRef(null);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `kpss-verilerim-${todayStr()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const rows = [["Deneme", "Tarih", "Toplam Net"]];
    state.exams.forEach(e => rows.push([e.name, e.date, fmtNet(calcExamTotalNet(e, s.wrongPenaltyDivisor))]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `denemeler-${todayStr()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        setState(st => ({ ...st, ...parsed }));
        alert("Veriler başarıyla içe aktarıldı.");
      } catch (err) { alert("Dosya okunamadı, geçerli bir JSON yedeği seçtiğinizden emin olun."); }
    };
    reader.readAsText(file);
  };

  const resetAll = async () => {
    if (!confirm("Tüm verileriniz silinecek, emin misiniz? Bu işlem geri alınamaz.")) return;
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* quota */ }
    try {
      if (userId && isSupabaseConfigured && supabase) {
        await supabase.from("user_states").delete().eq("user_id", userId);
      }
    } catch (e) { /* bağlantı sorunu olabilir, sessizce geç */ }
    setState(defaultState());
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <Card className="p-6">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Genel Ayarlar</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Sınav Tarihi"><input type="date" className={inputCls} value={s.examDate} onChange={e => set({ examDate: e.target.value })} /></Field>
          <Field label="Yanlış Hesaplama (kaç yanlış 1 doğruyu götürür)"><input type="number" min="1" className={inputCls} value={s.wrongPenaltyDivisor} onChange={e => set({ wrongPenaltyDivisor: Math.max(1, +e.target.value) })} /></Field>
          <Field label="Günlük Çalışma Hedefi (dakika)"><input type="number" min="10" className={inputCls} value={s.dailyGoalMinutes} onChange={e => set({ dailyGoalMinutes: +e.target.value })} /></Field>
          <Field label="Haftalık Çalışma Hedefi (dakika)"><input type="number" min="60" className={inputCls} value={s.weeklyGoalMinutes} onChange={e => set({ weeklyGoalMinutes: +e.target.value })} /></Field>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Görünüm</h3>
        <div className="flex gap-2">
          <button onClick={() => set({ theme: "light" })} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${s.theme === "light" ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}><Sun size={16} /> Açık</button>
          <button onClick={() => set({ theme: "dark" })} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${s.theme === "dark" ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}><Moon size={16} /> Koyu</button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Veri Yönetimi</h3>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportJSON} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-medium text-slate-600 dark:text-slate-300"><Download size={16} /> JSON Dışa Aktar</button>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-medium text-slate-600 dark:text-slate-300"><Download size={16} /> Denemeler CSV</button>
          <button onClick={() => fileInputRef.current.click()} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-medium text-slate-600 dark:text-slate-300"><Upload size={16} /> JSON İçe Aktar</button>
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={importJSON} />
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button onClick={resetAll} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-sm font-medium text-rose-600"><Trash2 size={16} /> Tüm Verileri Sıfırla</button>
        </div>
      </Card>
    </div>
  );
}

/* ============================== ONBOARDING ============================== */

function Onboarding({ setState }) {
  const [step, setStep] = useState(0);
  const [examChoice, setExamChoice] = useState(null);   // { id, code, name }
  const [programChoice, setProgramChoice] = useState(null); // { id, code, name }
  const [f, setF] = useState({ examDate: addDays(todayStr(), 180), targetScore: 90, targetNet: 85, dailyGoalMinutes: 300 });
  const [exam, setExam] = useState({ name: "İlk Değerlendirme", date: todayStr(), subjects: Object.fromEntries(SUBJECTS.map(s => [s.key, { correct: 0, wrong: 0, blank: 0 }])) });

  // Sınav katalog state'i (DB bağlantısı olmadan KPSS fallback)
  const [exams, setExams] = useState([
    { id: "kpss", code: "kpss_ortaogretim", name: "KPSS Ortaöğretim", description: "Ortaöğretim düzeyinde KPSS hazırlık", color: "#4F46E5" },
    { id: "yks",  code: "yks",              name: "YKS (TYT + AYT)",  description: "Yükseköğretim Kurumları Sınavı",   color: "#059669" },
    { id: "lgs",  code: "lgs",              name: "LGS",               description: "Liselere Geçiş Sınavı",             color: "#D97706" },
  ]);
  const [programs, setPrograms] = useState({
    kpss: [
      { id: "kpss_gy", name: "Genel Yetenek", description: "Türkçe + Matematik" },
      { id: "kpss_gk", name: "Genel Kültür",  description: "Tarih + Coğrafya + Vatandaşlık + Güncel" },
    ],
    yks: [
      { id: "yks_tyt", name: "TYT", description: "Temel Yeterlilik Testi" },
      { id: "yks_ayt", name: "AYT", description: "Alan Yeterlilik Testi" },
    ],
    lgs: [
      { id: "lgs_lgs", name: "LGS (Tek Aşama)", description: "Sayısal + Sözel" },
    ],
  });

  useEffect(() => {
    // DB'den çekmeyi dene; hata olursa fallback kullan
    (async () => {
      try {
        if (isSupabaseConfigured && supabase) {
          const { data, error } = await supabase
            .from("exams")
            .select("id, code, name, description, short_label")
            .eq("active", true)
            .order("sort_order");
          if (!error && data && data.length) {
            setExams(data.map((r) => ({ ...r, color: "#4F46E5" })));
          }
          const { data: progData } = await supabase.from("exam_programs").select("id, exam_id, name, code").order("sort_order");
          if (progData && progData.length) {
            const grouped = {};
            progData.forEach((p) => {
              const ex = data?.find((e) => e.id === p.exam_id);
              const key = ex?.id || p.exam_id;
              if (!grouped[key]) grouped[key] = [];
              grouped[key].push({ id: p.id, name: p.name, description: "" });
            });
            setPrograms(grouped);
          }
        }
      } catch { /* fallback */ }
    })();
  }, []);

  const finish = (withExamData, withDemo) => {
    setState(s => {
      let ns = { ...s, settings: { ...s.settings, ...f, onboarded: true } };
      if (withExamData) ns = { ...ns, exams: [{ ...exam, id: uid() }] };
      if (withDemo) ns = seedDemoData({ ...ns, settings: { ...ns.settings, demoSeeded: true } });
      return ns;
    });
  };

  const setSub = (key, field, val) => setExam({ ...exam, subjects: { ...exam.subjects, [key]: { ...exam.subjects[key], [field]: Math.max(0, +val) } } });

  const examList = exams;
  const programList = examChoice ? (programs[examChoice.id] || []) : [];
  const totalSteps = 5;

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg,#EEF2FF,#F5F3FF)" }}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-7">
        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: "linear-gradient(135deg,#4338CA,#7C3AED)" }}>
            <Target className="text-white" size={22} />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Sınava hazırlanırken sana yardımcı olalım.</h2>
          <div className="flex justify-center gap-1.5 mt-3">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-8 bg-indigo-600" : "w-1.5 bg-slate-200"}`} />
            ))}
          </div>
        </div>

        {step === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500 mb-2">Hangi sınava hazırlanıyorsun?</p>
            <div className="grid gap-2">
              {examList.map(e => (
                <button key={e.id} onClick={() => { setExamChoice(e); setStep(1); }}
                  className="w-full text-left p-4 rounded-xl border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50/30 transition flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-800">{e.name}</div>
                    <div className="text-xs text-slate-500">{e.description}</div>
                  </div>
                  <span className="text-indigo-500 text-xl">→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <button onClick={() => setStep(0)} className="text-xs text-slate-400">← Sınav değiştir</button>
            <p className="text-sm text-slate-500 mb-2">Hangi program/alandan hazırlanıyorsun?</p>
            <div className="grid gap-2">
              {programList.map(p => (
                <button key={p.id} onClick={() => { setProgramChoice(p); setStep(2); }}
                  className="w-full text-left p-4 rounded-xl border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50/30 transition flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-800">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.description}</div>
                  </div>
                  <span className="text-indigo-500 text-xl">→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <button onClick={() => setStep(1)} className="text-xs text-slate-400">← Geri</button>
            <Field label="Sınav Tarihi"><input type="date" className={inputCls} value={f.examDate} onChange={e => setF({ ...f, examDate: e.target.value })} /></Field>
            <Field label="Günde ortalama ne kadar çalışabilirsin? (dakika)"><input type="number" min="10" className={inputCls} value={f.dailyGoalMinutes} onChange={e => setF({ ...f, dailyGoalMinutes: +e.target.value })} /></Field>
            <button onClick={() => setStep(3)} className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700">Devam Et</button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <button onClick={() => setStep(2)} className="text-xs text-slate-400">← Geri</button>
            <Field label="Hedef Puan"><input type="number" className={inputCls} value={f.targetScore} onChange={e => setF({ ...f, targetScore: +e.target.value })} /></Field>
            <Field label="Hedef Net"><input type="number" className={inputCls} value={f.targetNet} onChange={e => setF({ ...f, targetNet: +e.target.value })} /></Field>
            <button onClick={() => setStep(4)} className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700">Devam Et</button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <button onClick={() => setStep(3)} className="text-xs text-slate-400">← Geri</button>
            <p className="text-sm text-slate-500 mb-2">Mevcut seviyeni belirleyelim. İstersen bir deneme sonucu gir, istersen demo veriyle başla.</p>
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {SUBJECTS.map(s => {
                const r = exam.subjects[s.key] || { correct: 0, wrong: 0, blank: 0 };
                return (
                  <div key={s.key} className="rounded-xl border border-slate-100 p-2.5">
                    <div className="text-xs font-medium text-slate-600 mb-1.5">{s.name}</div>
                    <div className="grid grid-cols-3 gap-2">
                      <input type="number" min="0" className={inputCls} placeholder="Doğru" value={r.correct} onChange={e => setSub(s.key, "correct", e.target.value)} />
                      <input type="number" min="0" className={inputCls} placeholder="Yanlış" value={r.wrong} onChange={e => setSub(s.key, "wrong", e.target.value)} />
                      <input type="number" min="0" className={inputCls} placeholder="Boş" value={r.blank} onChange={e => setSub(s.key, "blank", e.target.value)} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => finish(false, true)} className="flex-1 py-2.5 rounded-lg bg-slate-100 text-slate-600 font-medium text-sm">Demo ile başla</button>
              <button onClick={() => finish(true, false)} className="flex-1 py-2.5 rounded-lg bg-indigo-600 text-white font-medium text-sm">Kaydet ve başla</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================== ANA UYGULAMA ============================== */

const NAV = [
  { key: "dashboard", label: "Panel", icon: Home },
  { key: "topics", label: "Konular", icon: BookOpen },
  { key: "exams", label: "Denemeler", icon: ClipboardList },
  { key: "plan", label: "Çalışma Planı", icon: Timer },
  { key: "calendar", label: "Takvim", icon: CalendarDays },
  { key: "stats", label: "İstatistikler", icon: BarChart3 },
  { key: "goals", label: "Hedefler", icon: Target },
  { key: "settings", label: "Ayarlar", icon: SettingsIcon },
];

export default function App() {
  const auth = useAuth();
  const [authView, setAuthView] = useState("login"); // login | register | forgot
  const [state, setState, loaded] = useKpssState(auth.user?.id);
  const [view, setView] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const dark = state.settings.theme === "dark";

  if (auth.authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Yükleniyor…</div>;
  }

  if (!auth.session) {
    // Landing page üzerinden gelen "Giriş / Kayıt Ol" aksiyonları için auth ekranına yönlendir.
    if (authView === "register") {
      return <RegisterScreen auth={auth} onGoLogin={() => setAuthView("login")} />;
    }
    if (authView === "forgot") {
      return <ForgotPasswordScreen auth={auth} onGoLogin={() => setAuthView("login")} />;
    }
    if (authView === "login") {
      return (
        <LoginScreen
          auth={auth}
          onGoRegister={() => setAuthView("register")}
          onGoForgot={() => setAuthView("forgot")}
        />
      );
    }
    return <LandingPage />;
  }

  if (!loaded) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Yükleniyor…</div>;
  }

  if (!state.settings.onboarded) {
    return <Onboarding setState={setState} />;
  }

  const PageComp = {
    dashboard: <Dashboard state={state} setState={setState} go={setView} />,
    topics: <TopicsPage state={state} setState={setState} />,
    exams: <ExamsPage state={state} setState={setState} />,
    plan: <PlanPage state={state} setState={setState} />,
    calendar: <CalendarPage state={state} />,
    stats: <StatsPage state={state} />,
    goals: <GoalsPage state={state} setState={setState} />,
    settings: <SettingsPage state={state} setState={setState} />,
  }[view];

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center gap-2 px-2 mb-6">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#4338CA,#7C3AED)" }}><Target className="text-white" size={16} /></div>
            <span className="font-bold text-slate-800 dark:text-slate-100">{BRAND.shortName}</span>
          </div>
          <nav className="space-y-1 flex-1">
            {NAV.map(n => (
              <button key={n.key} onClick={() => setView(n.key)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${view === n.key ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300" : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                aria-current={view === n.key ? "page" : undefined}>
                <n.icon size={17} aria-hidden="true" /> {n.label}
              </button>
            ))}
          </nav>
          <button onClick={() => setState(s => ({ ...s, settings: { ...s.settings, theme: dark ? "light" : "dark" } }))}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400"
            aria-label={dark ? "Açık moda geç" : "Koyu moda geç"}>
            {dark ? <Sun size={16} /> : <Moon size={16} />} {dark ? "Açık Mod" : "Koyu Mod"}
          </button>
          <button onClick={() => auth.signOut()} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-red-500"
            aria-label="Çıkış yap">
            <LogOut size={16} /> Çıkış Yap
          </button>
        </aside>

        {/* Mobile top bar */}
        <div className="lg:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 py-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#4338CA,#7C3AED)" }}><Target className="text-white" size={14} /></div>
            <span className="font-bold text-sm">{BRAND.shortName}</span>
          </div>
          <button onClick={() => setSidebarOpen(true)} aria-label="Menüyü aç"><Menu size={20} /></button>
        </div>

        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-slate-900/50" onClick={() => setSidebarOpen(false)}>
            <div className="absolute right-0 top-0 bottom-0 w-64 bg-white dark:bg-slate-900 p-4" onClick={e => e.stopPropagation()}>
              <div className="flex justify-end mb-4"><button onClick={() => setSidebarOpen(false)}><X size={20} /></button></div>
              <nav className="space-y-1">
                {NAV.map(n => (
                  <button key={n.key} onClick={() => { setView(n.key); setSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${view === n.key ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300" : "text-slate-500"}`}>
                    <n.icon size={17} /> {n.label}
                  </button>
                ))}
                <button onClick={() => setState(s => ({ ...s, settings: { ...s.settings, theme: dark ? "light" : "dark" } }))} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-400">
                  {dark ? <Sun size={16} /> : <Moon size={16} />} {dark ? "Açık Mod" : "Koyu Mod"}
                </button>
                <button onClick={() => auth.signOut()} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-400 hover:text-red-500">
                  <LogOut size={16} /> Çıkış Yap
                </button>
              </nav>
            </div>
          </div>
        )}

        <main className="flex-1 min-w-0 p-4 pt-16 lg:pt-6 lg:p-8 pb-20 lg:pb-8">
          <h1 className="hidden lg:block text-xl font-bold mb-5 text-slate-800 dark:text-slate-100">{NAV.find(n => n.key === view)?.label}</h1>
          {PageComp}
        </main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex overflow-x-auto" role="navigation" aria-label="Ana navigasyon">
          {NAV.map(n => (
            <button key={n.key} onClick={() => setView(n.key)}
              className={`flex-1 min-w-[64px] flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${view === n.key ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`}
              aria-current={view === n.key ? "page" : undefined}
              aria-label={n.label}>
              <n.icon size={18} aria-hidden="true" /> {n.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
