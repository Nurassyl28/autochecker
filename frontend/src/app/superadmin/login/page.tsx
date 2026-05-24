"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function SuperAdminLogin() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch(`${BASE_URL}/superadmin/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    if (res.ok) {
      localStorage.setItem("superadmin_key", key);
      router.replace("/superadmin");
    } else {
      setError("Неверный ключ");
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#0f0f1a", fontFamily: "Inter, sans-serif" }}>
      <div style={{ backgroundColor: "#1a1a2e", border: "1px solid #2d2d4e", borderRadius: "16px", padding: "40px", width: "360px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "28px" }}>
          <div style={{ width: "40px", height: "40px", backgroundColor: "#6d28d9", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>🔑</div>
          <div>
            <p style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "white" }}>Super Admin</p>
            <p style={{ margin: 0, fontSize: "12px", color: "#8b8ba0" }}>Платформенный доступ</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <input
            type="password"
            placeholder="Секретный ключ"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            required
            style={{ height: "44px", padding: "0 14px", backgroundColor: "#0f0f1a", border: "1px solid #2d2d4e", borderRadius: "8px", fontSize: "15px", color: "white", outline: "none" }}
          />
          {error && <p style={{ color: "#f87171", fontSize: "13px", margin: 0 }}>{error}</p>}
          <button type="submit" disabled={loading}
            style={{ height: "44px", backgroundColor: "#6d28d9", color: "white", border: "none", borderRadius: "8px", fontSize: "15px", fontWeight: 600, cursor: "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Проверяем..." : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}
