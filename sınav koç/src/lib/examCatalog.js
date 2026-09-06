import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

/**
 * Çoklu sınav katalog verisini Supabase'den çeker.
 * Dönüş şekli (App.jsx'in beklediği SUBJECTS/topics şekliyle uyumlu):
 * {
 *   exams: [{ id, code, name, shortLabel, description }],
 *   programs: [{ id, examId, code, name }],
 *   subjects: [{ id, key, name, color, programId, sortOrder, questionCount, wrongPenaltyDivisor }],
 *   topics: [{ id, name, subjectId, sortOrder }],
 *   loading: boolean,
 *   error: string|null,
 *   isFromCache: boolean
 * }
 */
const CACHE_KEY = "kpss-koc-catalog-v1";
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 saat

function loadCache() {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.fetchedAt) return null;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}
function saveCache(data) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, fetchedAt: Date.now() }));
  } catch {
    /* quota dolu, sessizce geç */
  }
}

/**
 * KPSS hardcoded fallback — Supabase bağlantısı yoksa veya ilk açılışta
 * kullanıcıyı eski davranışla karşılayalım.
 */
const KPSS_FALLBACK = {
  exams: [
    { id: "kpss", code: "kpss_ortaogretim", name: "KPSS Ortaöğretim", shortLabel: "KPSS", description: "" },
  ],
  programs: [
    { id: "kpss_gy", examId: "kpss", code: "gy", name: "Genel Yetenek" },
    { id: "kpss_gk", examId: "kpss", code: "gk", name: "Genel Kültür" },
    { id: "kpss_hepsi", examId: "kpss", code: "hepsi", name: "Genel Yetenek + Genel Kültür" },
  ],
  subjects: [
    { id: "s_turkce", key: "turkce", name: "Türkçe", color: "#4F46E5", programId: "kpss_gy", sortOrder: 10, questionCount: 30, wrongPenaltyDivisor: 4 },
    { id: "s_mat", key: "matematik", name: "Matematik", color: "#7C3AED", programId: "kpss_gy", sortOrder: 20, questionCount: 30, wrongPenaltyDivisor: 4 },
    { id: "s_tarih", key: "tarih", name: "Tarih", color: "#0891B2", programId: "kpss_gk", sortOrder: 10, questionCount: 27, wrongPenaltyDivisor: 4 },
    { id: "s_cog", key: "cografya", name: "Coğrafya", color: "#059669", programId: "kpss_gk", sortOrder: 20, questionCount: 18, wrongPenaltyDivisor: 4 },
    { id: "s_vat", key: "vatandaslik", name: "Vatandaşlık", color: "#D97706", programId: "kpss_gk", sortOrder: 30, questionCount: 9, wrongPenaltyDivisor: 4 },
    { id: "s_gun", key: "guncel", name: "Güncel Bilgiler", color: "#DC2626", programId: "kpss_gk", sortOrder: 40, questionCount: 6, wrongPenaltyDivisor: 4 },
  ],
  topics: [],
};

export function useExamCatalog() {
  const cached = loadCache();
  const [state, setState] = useState({
    exams: cached?.exams ?? [],
    programs: cached?.programs ?? [],
    subjects: cached?.subjects ?? [],
    topics: cached?.topics ?? [],
    loading: !cached,
    error: null,
    isFromCache: Boolean(cached),
  });

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setState((s) => ({ ...KPSS_FALLBACK, loading: false, error: null, isFromCache: false }));
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const [examsRes, programsRes, subjectsRes, topicsRes] = await Promise.all([
          supabase.from("exams").select("id, code, name, short_label, description, sort_order").eq("active", true).order("sort_order"),
          supabase.from("exam_programs").select("id, exam_id, code, name, sort_order").order("sort_order"),
          supabase.from("subjects").select("id, program_id, key, name, color, sort_order, question_count, wrong_penalty_divisor").order("sort_order"),
          supabase.from("topics").select("id, subject_id, name, sort_order, active").eq("active", true).order("sort_order"),
        ]);

        if (cancelled) return;

        if (examsRes.error) throw examsRes.error;
        if (programsRes.error) throw programsRes.error;
        if (subjectsRes.error) throw subjectsRes.error;
        if (topicsRes.error) throw topicsRes.error;

        const next = {
          exams: (examsRes.data || []).map((r) => ({
            id: r.id, code: r.code, name: r.name,
            shortLabel: r.short_label, description: r.description,
            sortOrder: r.sort_order,
          })),
          programs: (programsRes.data || []).map((r) => ({
            id: r.id, examId: r.exam_id, code: r.code, name: r.name, sortOrder: r.sort_order,
          })),
          subjects: (subjectsRes.data || []).map((r) => ({
            id: r.id, programId: r.program_id, key: r.key, name: r.name, color: r.color,
            sortOrder: r.sort_order, questionCount: r.question_count, wrongPenaltyDivisor: r.wrong_penalty_divisor,
          })),
          topics: (topicsRes.data || []).map((r) => ({
            id: r.id, subjectId: r.subject_id, name: r.name, sortOrder: r.sort_order,
          })),
        };

        saveCache(next);
        setState({ ...next, loading: false, error: null, isFromCache: false });
      } catch (err) {
        if (cancelled) return;
        // Hata durumunda cache varsa onu kullan, yoksa KPSS fallback
        const c = loadCache();
        if (c) {
          setState({ exams: c.exams, programs: c.programs, subjects: c.subjects, topics: c.topics, loading: false, error: err?.message || "Katalog yüklenemedi", isFromCache: true });
        } else {
          setState({ ...KPSS_FALLBACK, loading: false, error: err?.message || "Katalog yüklenemedi", isFromCache: false });
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return state;
}

/**
 * Program ID'ye göre dersleri filtreler (App.jsx'in beklediği şekilde).
 */
export function subjectsForProgram(catalog, programId) {
  if (!catalog?.subjects) return [];
  return catalog.subjects
    .filter((s) => s.programId === programId)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

/**
 * Program ID'ye göre konuları gruplayıp döner: { [subjectId]: [topics] }
 */
export function topicsForProgram(catalog, programId) {
  const subjects = subjectsForProgram(catalog, programId);
  const subjIds = new Set(subjects.map((s) => s.id));
  const grouped = {};
  subjects.forEach((s) => { grouped[s.id] = []; });
  (catalog?.topics || [])
    .filter((t) => subjIds.has(t.subjectId))
    .forEach((t) => {
      if (!grouped[t.subjectId]) grouped[t.subjectId] = [];
      grouped[t.subjectId].push(t);
    });
  return grouped;
}

/**
 * Mevcut SUBJECTS şeklinde (geriye uyumlu) sanal array üretir.
 * App.jsx'in calcSubjectNet gibi fonksiyonları bu shape'i bekliyor.
 */
export function buildLegacySubjects(catalog, programId) {
  const subs = subjectsForProgram(catalog, programId);
  const topicsGrouped = topicsForProgram(catalog, programId);
  return subs.map((s) => ({
    key: s.key,
    name: s.name,
    color: s.color,
    _id: s.id,
    topics: (topicsGrouped[s.id] || []).map((t) => t.name),
  }));
}