/**
 * App.jsx içinde dağınık helper fonksiyonları buraya taşınır.
 * Tekrar eden hesaplamalar için tek doğru kaynak.
 */

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const todayStr = () => new Date().toISOString().slice(0, 10);

export const addDays = (dateStr, n) => {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export const diffDaysFromToday = (dateStr) => {
  if (!dateStr) return null;
  const a = new Date(todayStr() + "T00:00:00");
  const b = new Date(dateStr + "T00:00:00");
  return Math.round((b - a) / 86400000);
};

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export const fmtMin = (mins) => {
  const m = Number(mins) || 0;
  const h = Math.floor(m / 60), mm = Math.round(m % 60);
  if (h <= 0) return `${mm} dk`;
  return `${h} sa ${mm} dk`;
};

export const fmtNet = (n) => {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Bir ders için net hesapla (yanlış sayısı / wrongPenaltyDivisor).
 */
export function calcSubjectNet(res, divisor = 4) {
  if (!res) return 0;
  return (res.correct || 0) - (res.wrong || 0) / (divisor || 4);
}

/**
 * Denemenin toplam neti.
 * subjects: { [key]: { correct, wrong, blank } }
 */
export function calcExamTotalNet(exam, divisor = 4) {
  if (!exam?.subjects) return 0;
  return Object.values(exam.subjects).reduce((sum, s) => sum + calcSubjectNet(s, divisor), 0);
}

/**
 * Bir topic için başarı oranı (%): correct / (correct + wrong)
 * Boş veri ise null.
 */
export function topicSuccessRate(t) {
  if (!t) return null;
  const total = (t.correct || 0) + (t.wrong || 0);
  if (total === 0) return null;
  return (t.correct / total) * 100;
}

/**
 * Başarı oranını seviye etiketine çevir.
 */
export function successLevel(rate) {
  if (rate == null) return { label: "Veri Yok", color: "#94A3B8" };
  if (rate < 50) return { label: "Çok Zayıf", color: "#DC2626" };
  if (rate < 65) return { label: "Geliştirilmeli", color: "#D97706" };
  if (rate < 80) return { label: "Orta", color: "#0284C7" };
  if (rate < 90) return { label: "İyi", color: "#059669" };
  return { label: "Çok İyi", color: "#7C3AED" };
}

/**
 * Streak hesapla (birbirini izleyen günler, günlük hedefin yarısını geçen günler).
 */
export function computeStreak(dailyLogs, dailyGoalMinutes) {
  if (!dailyLogs) return 0;
  let streak = 0;
  let d = todayStr();
  if (!dailyLogs[d] || dailyLogs[d].minutes < dailyGoalMinutes * 0.5) {
    d = addDays(d, -1);
  }
  while (dailyLogs[d] && dailyLogs[d].minutes >= dailyGoalMinutes * 0.5) {
    streak += 1;
    d = addDays(d, -1);
  }
  return streak;
}