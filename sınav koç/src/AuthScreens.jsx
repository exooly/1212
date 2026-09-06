import React, { useState } from "react";
import { Target, Eye, EyeOff, Loader2 } from "lucide-react";
import { BRAND } from "./lib/brand";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-400";

function Logo() {
  return (
    <div className="text-center mb-5">
      <div
        className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
        style={{ background: "linear-gradient(135deg,#4338CA,#7C3AED)" }}
      >
        <Target className="text-white" size={22} />
      </div>
      <h1 className="text-lg font-bold text-slate-800">{BRAND.shortName}</h1>
    </div>
  );
}

function ErrorBox({ message }) {
  if (!message) return null;
  return (
    <div className="rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm px-3 py-2">
      {message}
    </div>
  );
}

function SuccessBox({ message }) {
  if (!message) return null;
  return (
    <div className="rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm px-3 py-2">
      {message}
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        className={inputCls + " pr-9"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="current-password"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        tabIndex={-1}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

const SHELL_BG = { background: "linear-gradient(135deg,#EEF2FF,#F5F3FF)" };

function Shell({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={SHELL_BG}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-7">{children}</div>
    </div>
  );
}

export function LoginScreen({ auth, onGoRegister, onGoForgot }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Lütfen e-posta adresinizi girin.");
      return;
    }
    if (!password) {
      setError("Lütfen şifrenizi girin.");
      return;
    }

    setLoading(true);
    const { error: err } = await auth.signIn(email.trim(), password);
    setLoading(false);
    if (err === "config") {
      setError("Sistem henüz yapılandırılmadı. Lütfen site yöneticisiyle iletişime geçin.");
    } else if (err) {
      setError(err);
    }
  };

  return (
    <Shell>
      <Logo />
      <form onSubmit={submit} className="space-y-3">
        <ErrorBox message={error} />
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">E-posta</label>
          <input
            type="email"
            className={inputCls}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ornek@eposta.com"
            autoComplete="email"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Şifre</label>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        <div className="text-right">
          <button
            type="button"
            onClick={onGoForgot}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Şifremi Unuttum
          </button>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          Giriş Yap
        </button>
      </form>
      <div className="text-center mt-4 text-sm text-slate-500">
        Hesabın yok mu?{" "}
        <button onClick={onGoRegister} className="text-indigo-600 font-medium hover:text-indigo-700">
          Kayıt Ol
        </button>
      </div>
    </Shell>
  );
}

export function RegisterScreen({ auth, onGoLogin }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!fullName.trim()) {
      setError("Lütfen ad soyad girin.");
      return;
    }
    if (!email.trim()) {
      setError("Lütfen e-posta adresinizi girin.");
      return;
    }
    if (password.length < 6) {
      setError("Şifre çok kısa. En az 6 karakter olmalı.");
      return;
    }
    if (password !== password2) {
      setError("Şifreler eşleşmiyor.");
      return;
    }

    setLoading(true);
    const { error: err } = await auth.signUp(email.trim(), password, fullName.trim());
    setLoading(false);
    if (err === "config") {
      setError("Sistem henüz yapılandırılmadı. Lütfen site yöneticisiyle iletişime geçin.");
    } else if (err) {
      setError(err);
    } else {
      setSuccess("Hesabınız oluşturuldu! E-posta adresinize gelen onay bağlantısına tıklayıp giriş yapabilirsiniz.");
    }
  };

  return (
    <Shell>
      <Logo />
      <form onSubmit={submit} className="space-y-3">
        <ErrorBox message={error} />
        <SuccessBox message={success} />
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Ad Soyad</label>
          <input
            type="text"
            className={inputCls}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ad Soyad"
            autoComplete="name"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">E-posta</label>
          <input
            type="email"
            className={inputCls}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ornek@eposta.com"
            autoComplete="email"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Şifre</label>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="En az 6 karakter" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Şifre Tekrar</label>
          <PasswordInput value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="Şifrenizi tekrar girin" />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          Hesap Oluştur
        </button>
      </form>
      <div className="text-center mt-4 text-sm text-slate-500">
        Zaten hesabın var mı?{" "}
        <button onClick={onGoLogin} className="text-indigo-600 font-medium hover:text-indigo-700">
          Giriş Yap
        </button>
      </div>
    </Shell>
  );
}

export function ForgotPasswordScreen({ auth, onGoLogin }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!email.trim()) {
      setError("Lütfen e-posta adresinizi girin.");
      return;
    }

    setLoading(true);
    const { error: err } = await auth.resetPassword(email.trim());
    setLoading(false);
    if (err === "config") {
      setError("Sistem henüz yapılandırılmadı. Lütfen site yöneticisiyle iletişime geçin.");
    } else if (err) {
      setError(err);
    } else {
      setSuccess("Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.");
    }
  };

  return (
    <Shell>
      <Logo />
      <p className="text-sm text-slate-500 text-center mb-4">
        E-posta adresinizi girin, şifre sıfırlama bağlantısı gönderelim.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <ErrorBox message={error} />
        <SuccessBox message={success} />
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">E-posta</label>
          <input
            type="email"
            className={inputCls}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ornek@eposta.com"
            autoComplete="email"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          Sıfırlama Bağlantısı Gönder
        </button>
      </form>
      <div className="text-center mt-4 text-sm text-slate-500">
        <button onClick={onGoLogin} className="text-indigo-600 font-medium hover:text-indigo-700">
          Giriş ekranına dön
        </button>
      </div>
    </Shell>
  );
}
