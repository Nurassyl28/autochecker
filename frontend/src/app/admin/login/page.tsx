"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ADMIN_CREDENTIALS = { email: "admin@autochecker.kz", password: "admin123" };

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setTimeout(() => {
      if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
        localStorage.setItem("admin_logged_in", "true");
        router.push("/admin");
      } else {
        setError("Неверный email или пароль.");
      }
      setLoading(false);
    }, 500);
  }

  return (
    <div style={{
      minHeight: "100vh", backgroundColor: "#f3f5fa",
      display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <header style={{
        backgroundColor: "#fdfeff", height: "66px",
        display: "flex", alignItems: "center", padding: "0 56px",
        borderBottom: "1px solid #eee",
      }}>
        <span style={{ color: "#3b2cce", fontSize: "18px", fontWeight: 500 }}>
          Autochecker — Админ-панель
        </span>
      </header>

      {/* Card */}
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{
          backgroundColor: "white", border: "1px solid #f1f0f1",
          borderRadius: "14px", width: "460px",
          padding: "40px 44px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
        }}>
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <div style={{
              width: "56px", height: "56px", borderRadius: "14px",
              backgroundColor: "#142175",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: "26px",
            }}>🛡</div>
            <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#000", margin: "0 0 6px" }}>
              Вход в систему
            </h1>
            <p style={{ fontSize: "15px", color: "#888", margin: 0 }}>
              Только для администраторов
            </p>
          </div>

          {/* Demo hint */}
          <div style={{
            backgroundColor: "#f0f0ff", border: "1px solid #d2d0ff",
            borderRadius: "10px", padding: "12px 16px",
            fontSize: "13px", color: "#3525cd", marginBottom: "22px",
          }}>
            <p style={{ fontWeight: 700, margin: "0 0 4px" }}>Тестовые данные:</p>
            <p style={{ margin: 0 }}>
              📧 <span style={{ fontFamily: "monospace" }}>admin@autochecker.kz</span>
            </p>
            <p style={{ margin: 0 }}>
              🔑 <span style={{ fontFamily: "monospace" }}>admin123</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            {/* Email */}
            <div>
              <label style={{ fontSize: "13px", fontWeight: 600, color: "#5b6475", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@autochecker.kz"
                required
                style={{
                  width: "100%", height: "52px",
                  border: "1.5px solid #dfdde8", borderRadius: "12px",
                  padding: "0 16px", fontSize: "16px", color: "#333",
                  outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label style={{ fontSize: "13px", fontWeight: 600, color: "#5b6475", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>
                Пароль
              </label>
              <div style={{
                display: "flex", alignItems: "center",
                border: "1.5px solid #dfdde8", borderRadius: "12px", overflow: "hidden",
              }}>
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    flex: 1, height: "52px",
                    border: "none", outline: "none",
                    padding: "0 16px", fontSize: "16px", color: "#333",
                    backgroundColor: "white",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    padding: "0 14px", fontSize: "17px", opacity: 0.5,
                  }}
                >
                  {showPw ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            {error && (
              <p style={{ fontSize: "14px", color: "#e53e3e", textAlign: "center", margin: 0 }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", height: "54px",
                backgroundColor: "#142175", color: "white",
                border: "none", borderRadius: "12px",
                fontSize: "16px", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                marginTop: "4px",
              }}
            >
              {loading ? "Входим..." : "Войти в панель"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
