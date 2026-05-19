"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Demo credentials
  const DEMO_TEACHER = { email: "nurasyl@autochecker.kz", password: "teacher123", id: "teacher_nurasyl", name: "Нурасыл М." };
  const DEMO_STUDENT = { email: "muhammad@autochecker.kz", password: "student123", id: "3", name: "Мухаммад Шералхан" };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // ── Demo login (no backend needed) ──────────────────────────────────────
      if (role === "teacher" && email === DEMO_TEACHER.email && password === DEMO_TEACHER.password) {
        sessionStorage.setItem("user_role", "teacher");
        sessionStorage.setItem("user_id", DEMO_TEACHER.id);
        sessionStorage.setItem("user_name", DEMO_TEACHER.name);
        router.push("/dashboard");
        return;
      }
      if (role === "student" && email === DEMO_STUDENT.email && password === DEMO_STUDENT.password) {
        sessionStorage.setItem("user_role", "student");
        sessionStorage.setItem("user_id", DEMO_STUDENT.id);
        sessionStorage.setItem("user_name", DEMO_STUDENT.name);
        router.push("/dashboard");
        return;
      }

      // ── Real backend login ───────────────────────────────────────────────────
      const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

      if (role === "teacher") {
        const form = new FormData();
        form.append("password", password);
        const res = await fetch(`${BASE}/login`, {
          method: "POST",
          body: form,
          redirect: "manual",
          credentials: "include",
        });
        if (res.status === 302 || res.ok) {
          sessionStorage.setItem("user_role", "teacher");
          router.push("/dashboard");
        } else {
          setError("Неверный пароль. Попробуйте снова.");
        }
      } else {
        sessionStorage.setItem("user_role", "student");
        router.push("/dashboard");
      }
    } catch {
      setError("Ошибка подключения к серверу.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f3f5fa] flex flex-col">
      {/* Header */}
      <header className="bg-[#fdfeff] h-[66px] flex items-center px-14 border-b border-[#eee]">
        <Link href="/" className="text-[#3b2cce] text-[18.5px] font-medium">
          Autochecker
        </Link>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center py-10">
        <div className="bg-[#fefefe] border border-[#f1f0f1] rounded-[13px] w-[517px] py-10 px-12 shadow-sm">
          {/* Welcome */}
          <p className="text-[18px] text-black text-center mb-1">С возвращением!</p>
          <p className="text-[17px] text-black text-center mb-8">
            Продолжите свое обучение с Autochecker
          </p>

          {/* Role Switcher */}
          <p className="text-[14px] font-semibold text-[#5b6475] uppercase tracking-wide mb-3">
            Выберите роль
          </p>
          <div className="bg-[#eceef0] rounded-[13px] p-1.5 flex gap-1 mb-6">
            <button
              onClick={() => setRole("student")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[10px] text-[18.5px] transition-all ${
                role === "student"
                  ? "bg-white text-[#0b09cc] shadow-sm"
                  : "text-[#404040] hover:bg-white/50"
              }`}
            >
              <Image
                src="/assets/icons/student-icon.png"
                alt="Студент"
                width={20}
                height={20}
                className="object-contain"
              />
              Студент
            </button>
            <button
              onClick={() => setRole("teacher")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[10px] text-[18.5px] transition-all ${
                role === "teacher"
                  ? "bg-white text-[#0b09cc] shadow-sm"
                  : "text-[#404040] hover:bg-white/50"
              }`}
            >
              <Image
                src="/assets/icons/teacher-icon.png"
                alt="Учитель"
                width={20}
                height={20}
                className="object-contain"
              />
              Учитель
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <p className="text-[14px] font-semibold text-[#5b6475] uppercase tracking-wide mb-2">
                Электронная почта
              </p>
              <div className="flex items-center bg-white border border-[#dfdde8] rounded-[12px] h-[60px] px-4 gap-3 focus-within:border-[#3525cd] focus-within:ring-2 focus-within:ring-[#3525cd]/10 transition-all">
                <Image
                  src="/assets/icons/email-icon.png"
                  alt=""
                  width={24}
                  height={24}
                  className="object-contain opacity-60"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@edu.com"
                  required
                  className="flex-1 outline-none text-[17px] text-[#333] placeholder-[#6a7280] bg-transparent"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[14px] font-semibold text-[#5b6475] uppercase tracking-wide">
                  Пароль
                </p>
                <button
                  type="button"
                  className="text-[16.5px] text-[#0500ce] hover:underline"
                  tabIndex={-1}
                >
                  Забыли пароль?
                </button>
              </div>
              <div className="flex items-center bg-white border border-[#dfdde8] rounded-[12px] h-[60px] px-4 gap-3 focus-within:border-[#3525cd] focus-within:ring-2 focus-within:ring-[#3525cd]/10 transition-all">
                <Image
                  src="/assets/icons/lock-icon.png"
                  alt=""
                  width={24}
                  height={24}
                  className="object-contain opacity-60"
                />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  required
                  className="flex-1 outline-none text-[17px] text-[#333] placeholder-[#6a7280] bg-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="opacity-50 hover:opacity-100 transition-opacity"
                >
                  <Image
                    src="/assets/icons/eye-icon.png"
                    alt="Показать"
                    width={24}
                    height={24}
                    className="object-contain"
                  />
                </button>
              </div>
            </div>

            {/* Quick-fill demo buttons */}
            <div className="bg-[#f0f0ff] border border-[#d2d0ff] rounded-[10px] p-3">
              <p className="text-[13px] font-semibold text-[#3525cd] mb-2">Быстрый вход (для теста):</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setRole("teacher"); setEmail(DEMO_TEACHER.email); setPassword(DEMO_TEACHER.password); }}
                  className="flex-1 flex items-center justify-center gap-2 h-[38px] bg-white border border-[#c5caff] rounded-[9px] text-[13px] text-[#3525cd] font-semibold hover:bg-[#eef0ff] transition-colors"
                >
                  👨‍🏫 Нурасыл М.
                </button>
                <button
                  type="button"
                  onClick={() => { setRole("student"); setEmail(DEMO_STUDENT.email); setPassword(DEMO_STUDENT.password); }}
                  className="flex-1 flex items-center justify-center gap-2 h-[38px] bg-white border border-[#c5caff] rounded-[9px] text-[13px] text-[#3525cd] font-semibold hover:bg-[#eef0ff] transition-colors"
                >
                  👨‍🎓 Мухаммад Ш.
                </button>
              </div>
              <button
                type="button"
                onClick={() => { router.push("/admin/login"); }}
                className="w-full flex items-center justify-center gap-2 h-[38px] bg-white border border-[#c5caff] rounded-[9px] text-[13px] text-[#3525cd] font-semibold hover:bg-[#eef0ff] transition-colors mt-2"
              >
                🛡 Войти как администратор
              </button>
            </div>

            {/* Error */}
            {error && (
              <p className="text-[14px] text-red-600 text-center">{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[60px] bg-[#4f46e5] hover:bg-[#4338ca] text-white text-[17px] font-normal rounded-[12px] transition-colors disabled:opacity-60 mt-2"
            >
              {loading ? "Входим..." : "Войти"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-[#e5e7eb]" />
            <span className="text-[17px] text-[#3f3f3f]">или продолжить с</span>
            <div className="flex-1 h-px bg-[#e5e7eb]" />
          </div>

          {/* Social */}
          <div className="flex gap-4">
            <button className="flex-1 flex items-center justify-center gap-3 h-[54px] bg-white border border-[#eae9f0] rounded-[13px] text-[17.5px] text-black hover:bg-gray-50 transition-colors">
              <Image
                src="/assets/icons/google-icon.png"
                alt="Google"
                width={26}
                height={26}
                className="object-contain"
              />
              Google
            </button>
            <button className="flex-1 flex items-center justify-center gap-3 h-[54px] bg-white border border-[#eae9f0] rounded-[13px] text-[17.5px] text-black hover:bg-gray-50 transition-colors">
              <Image
                src="/assets/icons/github-icon.png"
                alt="GitHub"
                width={26}
                height={26}
                className="object-contain"
              />
              GitHub
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-[60px] flex items-center justify-between px-14 text-[15px] text-[#585858]">
        <span>2026 Autochecker. Все права защищены</span>
        <div className="flex gap-8">
          <a href="#" className="hover:text-[#3525cd] transition-colors">Политика конфиденциальности</a>
          <a href="#" className="hover:text-[#3525cd] transition-colors">Условия использования</a>
          <a href="#" className="hover:text-[#3525cd] transition-colors">Центр помощи</a>
        </div>
      </footer>
    </div>
  );
}
