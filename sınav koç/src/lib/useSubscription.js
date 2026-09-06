import { useEffect, useState, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { useAuth } from "../useAuth";

const FREE_TRIAL_DAYS = 14;

function computeIsPremium(sub) {
  if (!sub) return false;
  if (sub.status === "active" || sub.status === "trial") {
    if (!sub.end_date) return sub.status === "active";
    return new Date(sub.end_date) > new Date();
  }
  return false;
}

function computeTrialDaysLeft(sub) {
  if (!sub || sub.status !== "trial" || !sub.end_date) return 0;
  const ms = new Date(sub.end_date) - new Date();
  return Math.max(0, Math.ceil(ms / 86400000));
}

export function useSubscription() {
  const { user } = useAuth();
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user || !isSupabaseConfigured || !supabase) {
      setSub({ status: "trial", plan: "free", end_date: new Date(Date.now() + FREE_TRIAL_DAYS * 86400000).toISOString() });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("status, plan, start_date, end_date, renewal_date, provider")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      setSub(data || { status: "trial", plan: "free" });
    } catch {
      setSub({ status: "trial", plan: "free" });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isPremium = computeIsPremium(sub);
  const trialDaysLeft = computeTrialDaysLeft(sub);

  return { sub, isPremium, trialDaysLeft, loading, refresh };
}

export function PremiumGate({ isPremium, feature, children, fallback }) {
  if (isPremium) return children;
  if (fallback) return fallback;
  return (
    <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/30 p-6 text-center">
      <div className="text-sm font-semibold text-indigo-700 mb-1">{feature} — Premium</div>
      <div className="text-xs text-slate-500 mb-3">Bu özelliğe erişmek için Premium'a geç.</div>
      <a href="#pricing" className="inline-block px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
        Premium'u İncele
      </a>
    </div>
  );
}