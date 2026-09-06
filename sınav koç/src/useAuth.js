import { useEffect, useState, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "./lib/supabaseClient";

/**
 * Supabase Authentication oturum yönetimi.
 * Sayfa yenilendiğinde Supabase kendi localStorage'ında (sb-*-auth-token)
 * oturumu sakladığı için kullanıcı tekrar giriş yapmak zorunda kalmaz.
 */
export function useAuth() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    if (!isSupabaseConfigured) return { error: "config" };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? mapAuthError(error) : null };
  }, []);

  const signUp = useCallback(async (email, password, fullName) => {
    if (!isSupabaseConfigured) return { error: "config" };
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return { error: error ? mapAuthError(error) : null };
  }, []);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
  }, []);

  const resetPassword = useCallback(async (email) => {
    if (!isSupabaseConfigured) return { error: "config" };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    return { error: error ? mapAuthError(error) : null };
  }, []);

  return {
    session,
    user: session?.user || null,
    authLoading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    isSupabaseConfigured,
  };
}

/**
 * Supabase'in İngilizce hata mesajlarını anlaşılır Türkçe mesajlara çevirir.
 */
function mapAuthError(error) {
  const msg = (error?.message || "").toLowerCase();

  if (msg.includes("invalid login credentials")) return "E-posta veya şifre hatalı.";
  if (msg.includes("email not confirmed")) return "E-posta adresinizi henüz onaylamadınız. Lütfen gelen kutunuzu kontrol edin.";
  if (msg.includes("user already registered") || msg.includes("already registered")) return "Bu e-posta adresi zaten kayıtlı.";
  if (msg.includes("password should be at least") || msg.includes("password") && msg.includes("least")) return "Şifre çok kısa. En az 6 karakter olmalı.";
  if (msg.includes("unable to validate email") || msg.includes("invalid email")) return "Geçersiz e-posta adresi.";
  if (msg.includes("rate limit")) return "Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.";
  if (msg.includes("network") || msg.includes("fetch")) return "İnternet bağlantısı hatası. Lütfen bağlantınızı kontrol edip tekrar deneyin.";

  return "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.";
}
