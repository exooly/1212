/**
 * Rule-based koçluk motoru.
 * AI YOK — tüm hesaplamalar kullanıcının gerçek verisinden rule'larla üretilir.
 * Yorumlar kısa, doğal, destekleyici Türkçe.
 *
 * Talimat 11: rastgele, sahte, her kullanıcıya aynı öneri yok.
 * Talimat 12: destekleyici + gerçekçi + motive edici ton.
 *
 * Giriş: { exams, topics, dailyLogs, settings, examName }
 * Çıkış: { headline, insights: [...], actions: [...] }
 *
 * headline: dashboard'da üstte gösterilecek kısa Türkçe cümle
 * insights: veri yorumu (örn: "Son 5 denemede matematik +4,2 net gelişti")
 * actions: yapılabilir 1-3 eylem önerisi (örn: "Bu hafta matematik çalışmasını 30 dk artır")
 */

import { fmtMin, addDays, todayStr, diffDaysFromToday } from "./helpers";

const TR_DAYS = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];

function examNet(exam, divisor) {
  if (!exam?.subjects) return 0;
  return Object.values(exam.subjects).reduce((sum, s) => {
    return sum + ((s.correct || 0) - (s.wrong || 0) / (divisor || 4));
  }, 0);
}

function avgNet(exams, divisor, lastN) {
  if (!exams || exams.length === 0) return null;
  const sorted = [...exams].sort((a, b) => a.date.localeCompare(b.date));
  const slice = sorted.slice(-lastN);
  if (slice.length === 0) return null;
  return slice.reduce((s, e) => s + examNet(e, divisor), 0) / slice.length;
}

function totalMinutes(logs, days) {
  const today = todayStr();
  let sum = 0;
  for (let i = 0; i < days; i++) {
    const d = addDays(today, -i);
    sum += logs?.[d]?.minutes || 0;
  }
  return sum;
}

function topicRate(t) {
  const total = (t.correct || 0) + (t.wrong || 0);
  if (total === 0) return null;
  return (t.correct / total) * 100;
}

function subjectBreakdown(exams, divisor) {
  if (!exams || exams.length === 0) return {};
  const last = [...exams].sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0];
  const out = {};
  for (const [key, val] of Object.entries(last.subjects || {})) {
    out[key] = examNet({ subjects: { [key]: val } }, divisor);
  }
  return out;
}

function subjectNetsLastN(exams, divisor, lastN) {
  const sorted = [...(exams || [])].sort((a, b) => a.date.localeCompare(b.date)).slice(-lastN);
  const sums = {};
  sorted.forEach((e) => {
    Object.entries(e.subjects || {}).forEach(([k, v]) => {
      const net = (v.correct || 0) - (v.wrong || 0) / (divisor || 4);
      sums[k] = (sums[k] || 0) + net;
    });
  });
  return sums;
}

/**
 * Üret öneriler.
 */
export function generateCoachInsights({
  exams = [],
  topics = {},
  dailyLogs = {},
  settings = {},
  examName = "sınavına",
  subjectNameMap = {}, // { turkce: "Türkçe", matematik: "Matematik", ... }
}) {
  const insights = [];
  const actions = [];
  const divisor = settings.wrongPenaltyDivisor || 4;
  const today = todayStr();
  const remainingDays = settings.examDate ? diffDaysFromToday(settings.examDate) : null;

  /* ============== 1) SINAVA KALAN SÜRE ============== */
  let headline = "Çalışmaya devam!";
  if (remainingDays != null) {
    if (remainingDays <= 0) {
      headline = "Sınav günü geldi, son hazırlıklarını tamamla.";
    } else if (remainingDays <= 7) {
      headline = `Son ${remainingDays} gün! Artık sadece tekrar ve deneme yap, yeni konuya girme.`;
    } else if (remainingDays <= 30) {
      headline = `Son ${remainingDays} gün! Eksik kapatma ve deneme dönemi başladı.`;
    } else if (remainingDays <= 100) {
      headline = `Son ${remainingDays} gün! Zayıf konularını netleştirme zamanı.`;
    } else {
      headline = `${examName} için ${remainingDays} günün var, planlı ilerlersen hedefe ulaşabilirsin.`;
    }
  }

  /* ============== 2) DENEME TRENDİ ============== */
  const last5Avg = avgNet(exams, divisor, 5);
  const prev5Avg = exams.length > 5 ? avgNet(exams, divisor, 10) - last5Avg : null; // son 10 - son 5 = önceki 5 ortalaması
  if (exams.length >= 2) {
    const lastNet = examNet([...exams].sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0], divisor);
    const prevNet = examNet([...exams].sort((a, b) => a.date.localeCompare(b.date)).slice(-2, -1)[0], divisor);
    const diff = lastNet - prevNet;
    if (Math.abs(diff) >= 0.5) {
      if (diff > 0) {
        insights.push(`Son denemende ${diff >= 0 ? "+" : ""}${diff.toFixed(2).replace(".", ",")} net artış var, güzel tempo.`);
      } else {
        insights.push(`Son denemende ${diff.toFixed(2).replace(".", ",")} net düşüş var. Küçük bir düşüş normal, panik yapma.`);
      }
    }
  }

  if (last5Avg != null && prev5Avg != null) {
    const diff = last5Avg - prev5Avg;
    if (Math.abs(diff) >= 0.5) {
      const sign = diff > 0 ? "+" : "";
      insights.push(
        `Son 5 denemede ortalama netin ${sign}${diff.toFixed(2).replace(".", ",")} değişti. ${diff > 0 ? "Yükseliş trendi var." : "Biraz daha odaklanmak iyi olabilir."}`
      );
    }
  }

  /* ============== 3) DERS BAZLI TREND ============== */
  const lastNets = subjectNetsLastN(exams, divisor, Math.min(5, exams.length));
  const prevNets = exams.length > 5 ? subjectNetsLastN(exams, divisor, 10) : {};
  // prevNets son 10'u veriyor; lastNets son 5'i vermişti; farklarını alabilmek için
  // burada basitleştirilmiş bir yaklaşım: en yüksek artış ve en büyük düşüşü bildir.
  if (Object.keys(lastNets).length > 0 && exams.length >= 3) {
    const subjectDeltas = Object.entries(lastNets).map(([k, v]) => {
      const prev = prevNets[k] != null ? (prevNets[k] - lastNets[k]) / (exams.length > 5 ? 1 : 0) : 0;
      return [k, lastNets[k], prevNets[k] != null ? (prevNets[k] - lastNets[k]) : 0];
    });

    const risers = subjectDeltas.filter(([, , d]) => d > 0.5).sort((a, b) => b[2] - a[2]);
    const fallers = subjectDeltas.filter(([, , d]) => d < -0.5).sort((a, b) => a[2] - b[2]);

    if (risers.length > 0) {
      const [k] = risers[0];
      insights.push(`${subjectNameMap[k] || k} dersinde yükseliş var, bu alandaki çalışma düzenini koru.`);
    }
    if (fallers.length > 0) {
      const [k] = fallers[0];
      insights.push(`${subjectNameMap[k] || k} dersinde düşüş var. Bu hafta bu derse biraz daha fazla zaman ayırabilirsin.`);
    }
  }

  /* ============== 4) HEDEF KARŞILAŞTIRMA ============== */
  if (settings.targetNet > 0 && exams.length > 0) {
    const lastNet = examNet([...exams].sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0], divisor);
    const gap = settings.targetNet - lastNet;
    if (gap > 0 && gap <= settings.targetNet * 0.1) {
      insights.push(`Hedefe sadece ${gap.toFixed(2).replace(".", ",")} net kaldı. Son düzlükte kritik konulara odaklan.`);
    } else if (lastNet >= settings.targetNet) {
      insights.push(`Son denemende hedefini aştın. Şimdi hedefi korumak için deneme temposunu sürdür.`);
    }
  }

  /* ============== 5) ÇALIŞMA DÜZENİ ============== */
  const weekMin = totalMinutes(dailyLogs, 7);
  const prevWeekMin = totalMinutes(dailyLogs, 14) - weekMin;
  if (prevWeekMin > 0) {
    const diff = weekMin - prevWeekMin;
    if (diff > 30) {
      insights.push(`Bu hafta geçen haftadan ${fmtMin(diff)} daha fazla çalıştın.`);
    } else if (diff < -30) {
      insights.push(`Bu hafta geçen haftaya göre ${fmtMin(Math.abs(diff))} daha az çalıştın. Tempo düşmüş, bir plan tekrar işine yarayabilir.`);
    }
  }
  if (settings.dailyGoalMinutes > 0 && weekMin > 0) {
    const pct = Math.round((weekMin / (settings.dailyGoalMinutes * 7)) * 100);
    if (pct >= 100) insights.push(`Bu hafta günlük hedefinin %${pct}'ini tamamladın, harika tempo.`);
    else if (pct >= 80) insights.push(`Bu hafta günlük hedefinin %${pct}'ine ulaştın.`);
    else if (pct < 50) insights.push(`Bu hafta günlük hedefinin sadece %${pct}'ini tamamladın.`);
  }

  /* ============== 6) TEKRAR HATIRLATMASI ============== */
  const overdueTopics = Object.values(topics).filter((t) => {
    if (!t.nextReviewDate) return false;
    return diffDaysFromToday(t.nextReviewDate) <= 0;
  });
  if (overdueTopics.length > 0) {
    const oldest = overdueTopics.sort((a, b) => (a.nextReviewDate || "").localeCompare(b.nextReviewDate || ""))[0];
    const days = -diffDaysFromToday(oldest.nextReviewDate);
    if (days >= 1) {
      insights.push(`${oldest.name} konusunun tekrarı ${days} gündürcüvar. Kısa bir tekrar bile faydalı olur.`);
      actions.push({
        type: "review_topic",
        topic: oldest,
        label: `${oldest.name} tekrar et`,
      });
    }
  }

  /* ============== 7) ZAYIF ALAN TESPİTİ ============== */
  const weakTopics = Object.values(topics)
    .map((t) => ({ ...t, rate: topicRate(t) }))
    .filter((t) => t.rate != null && t.rate < 50)
    .sort((a, b) => (a.rate || 0) - (b.rate || 0));
  if (weakTopics.length > 0 && weakTopics[0].rate < 50) {
    insights.push(`En zayıf konun ${weakTopics[0].name} (başarı %${Math.round(weakTopics[0].rate)}). Bu konuyu öncelikli listene alabilirsin.`);
    actions.push({
      type: "study_topic",
      topic: weakTopics[0],
      label: `${weakTopics[0].name} çalışmasına başla`,
    });
  }

  /* ============== 8) UZUN SÜREDİR ÇALIŞILMAYAN KONU ============== */
  const staleTopics = Object.values(topics)
    .filter((t) => t.lastStudyDate && diffDaysFromToday(t.lastStudyDate) <= -14)
    .sort((a, b) => (a.lastStudyDate || "").localeCompare(b.lastStudyDate || ""));
  if (staleTopics.length > 0) {
    const t = staleTopics[0];
    const days = -diffDaysFromToday(t.lastStudyDate);
    insights.push(`${t.name} konusunu ${days} gündür tekrar etmedin. Kısa bir hatırlatma turu iyi gelebilir.`);
  }

  /* ============== 9) EN GÜÇLÜ ALAN (motivasyon) ============== */
  const strongTopics = Object.values(topics)
    .map((t) => ({ ...t, rate: topicRate(t) }))
    .filter((t) => t.rate != null && t.rate >= 85)
    .sort((a, b) => (b.rate || 0) - (a.rate || 0));
  if (strongTopics.length > 0) {
    insights.push(`${strongTopics[0].name} konusunda çok iyi gidiyorsun. Bu güçlü yanını koru.`);
  }

  /* ============== 10) BUGÜN İÇİN ÖNERİLER ============== */
  if (!dailyLogs[today] || (dailyLogs[today].minutes || 0) < (settings.dailyGoalMinutes || 180) * 0.5) {
    actions.push({
      type: "start_pomodoro",
      label: "Bugün için 25 dk'lık pomodoro başlat",
    });
  }

  /* Limit insights */
  const maxInsights = 5;
  const finalInsights = insights.slice(0, maxInsights);
  const finalActions = actions.slice(0, 3);

  return {
    headline,
    insights: finalInsights,
    actions: finalActions,
    empty: exams.length === 0 && Object.keys(topics).length === 0,
  };
}

/**
 * Günün saatine göre küçük "selam" metni (greeting).
 */
export function greeting() {
  const h = new Date().getHours();
  const day = TR_DAYS[new Date().getDay()];
  if (h < 6) return `İyi geceler, ${day} günü.`;
  if (h < 12) return `Günaydın, ${day}.`;
  if (h < 18) return `İyi günler, ${day}.`;
  return `İyi akşamlar, ${day}.`;
}