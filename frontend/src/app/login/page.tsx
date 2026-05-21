"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";

const DEMO_ACCOUNTS = [
  { role: "teacher" as const, label: "👨‍🏫 Учитель",   email: "teacher@uni.edu",  password: "teacher123" },
  { role: "student" as const, label: "👨‍🎓 Студент 1", email: "student1@uni.edu", password: "pass1234" },
  { role: "student" as const, label: "👩‍🎓 Студент 2", email: "student2@uni.edu", password: "pass1234" },
];

export default function LoginPage() {
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await login(email, password);
      if (result.ok) {
        sessionStorage.setItem("user_role", result.role || role);
        sessionStorage.setItem("user_email", email);
        sessionStorage.setItem("user_id", String(result.user_id ?? ""));
        sessionStorage.setItem("user_name", result.full_name || email.split("@")[0]);
        router.push("/dashboard");
      } else {
        setError(result.error || "Неверный email или пароль.");
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
              <Image src="/assets/icons/student-icon.png" alt="Студент" width={20} height={20} className="object-contain" />
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
              <Image src="/assets/icons/teacher-icon.png" alt="Учитель" width={20} height={20} className="object-contain" />
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
                <Image src="/assets/icons/email-icon.png" alt="" width={24} height={24} className="object-contain opacity-60" />
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

            {/* Password — for all roles */}
            <div>
              <p className="text-[14px] font-semibold text-[#5b6475] uppercase tracking-wide mb-2">
                Пароль
              </p>
              <div className="flex items-center bg-white border border-[#dfdde8] rounded-[12px] h-[60px] px-4 gap-3 focus-within:border-[#3525cd] focus-within:ring-2 focus-within:ring-[#3525cd]/10 transition-all">
                <Image src="/assets/icons/lock-icon.png" alt="" width={24} height={24} className="object-contain opacity-60" />
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
                  <Image src="/assets/icons/eye-icon.png" alt="Показать" width={24} height={24} className="object-contain" />
                </button>
              </div>
            </div>

            {/* Demo accounts */}
            <div className="bg-[#f5f4ff] border border-[#d2d0ff] rounded-[10px] p-3">
              <p className="text-[12px] font-semibold text-[#3525cd] uppercase tracking-wide mb-2">
                Быстрый вход для теста
              </p>
              <div className="flex gap-2">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => {
                      setRole(acc.role);
                      setEmail(acc.email);
                      setPassword(acc.password);
                    }}
                    className="flex-1 h-[36px] bg-white border border-[#c5caff] rounded-[8px] text-[12px] text-[#3525cd] font-semibold hover:bg-[#eef0ff] transition-colors"
                  >
                    {acc.label}
                  </button>
                ))}
              </div>
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

          {/* Admin link */}
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => router.push("/admin/login")}
              className="text-[14px] text-[#888] hover:text-[#3525cd] transition-colors"
            >
              Войти как администратор
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
        </div>
      </footer>
    </div>
  );
}
