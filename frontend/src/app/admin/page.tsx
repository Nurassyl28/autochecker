"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getStudents, getDashboardStats } from "@/lib/api";

interface StudentRow {
  tg_id: number;
  github_alias: string;
  tg_username: string;
  email: string;
  student_group: string;
  last_submission: string;
  progress: number;
  avg_score: number;
  passed_tasks: number;
  total_tasks: number;
  total_attempts: number;
}

interface Stats {
  total_students: number;
  active_issues: number;
  stuck: number;
  avg_performance: number;
}

const AVATAR_COLORS = [
  "#1976d2", "#e91e63", "#4caf50", "#9c27b0", "#ff9800",
  "#f44336", "#00bcd4", "#795548", "#3f51b5", "#607d8b",
];

function getInitials(s: string) {
  return s.replace(/[-_]/g, " ").split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || s.slice(0, 2).toUpperCase();
}

export default function AdminPage() {
  const router = useRouter();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      getStudents().then((r) => (r.ok ? r.json() : [])),
      getDashboardStats().then((r) => (r.ok ? r.json() : null)),
    ]).then(([st, s]) => {
      if (Array.isArray(st)) setStudents(st);
      if (s) setStats(s);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("admin_logged_in")) {
      router.replace("/admin/login");
      return;
    }
    loadData();
  }, [router, loadData]);

  const filtered = students.filter((s) =>
    s.github_alias.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    (s.tg_username || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.student_group || "").toLowerCase().includes(search.toLowerCase())
  );

  const STAT_CARDS = stats ? [
    { label: "Всего пользователей", value: stats.total_students, icon: "👥", sub: "в системе", subColor: "#3525cd" },
    { label: "Активные проблемы",   value: stats.active_issues,  icon: "⚠️", sub: "студентов с ошибками", subColor: "#e53e3e" },
    { label: "В стопоре",           value: stats.stuck,           icon: "🔴", sub: "низкий прогресс", subColor: "#e53e3e" },
    { label: "Ср. успеваемость",    value: `${stats.avg_performance}%`, icon: "📈", sub: "по всем заданиям", subColor: "#3525cd" },
  ] : [];

  return (
    <div style={{ padding: "40px 45px", backgroundColor: "#fbf8ff", minHeight: "100%" }}>

      {/* Page title */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
        <div>
          <h1 style={{ fontSize: "34px", fontWeight: 700, color: "#000", margin: "0 0 6px" }}>
            🛡 Администрирование
          </h1>
          <p style={{ fontSize: "16px", color: "#666", margin: 0 }}>
            Управление пользователями и мониторинг системы
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <Link
            href="/dashboard"
            style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              height: "40px", padding: "0 18px",
              backgroundColor: "white", border: "1px solid #ddd",
              borderRadius: "8px", fontSize: "14px", color: "#333",
              textDecoration: "none", fontWeight: 500,
            }}
          >
            ← Дашборд
          </Link>
          <button
            onClick={() => { localStorage.removeItem("admin_logged_in"); router.push("/admin/login"); }}
            style={{
              height: "40px", padding: "0 18px",
              backgroundColor: "#fef2f2", border: "1px solid #fec7c7",
              borderRadius: "8px", fontSize: "14px", color: "#e53e3e",
              cursor: "pointer", fontWeight: 500,
            }}
          >
            Выйти
          </button>
        </div>
      </div>

      {/* Stats cards */}
      {STAT_CARDS.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "28px" }}>
          {STAT_CARDS.map((c) => (
            <div key={c.label} style={{
              backgroundColor: "white", border: "1px solid #e7e9ed",
              borderRadius: "12px", padding: "20px 22px",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
                <p style={{ fontSize: "14px", color: "#555", margin: 0 }}>{c.label}</p>
                <span style={{ fontSize: "22px" }}>{c.icon}</span>
              </div>
              <p style={{ fontSize: "32px", fontWeight: 700, color: "#000", margin: "0 0 4px" }}>{c.value}</p>
              <p style={{ fontSize: "13px", color: c.subColor, margin: 0 }}>{c.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Users table */}
      <div style={{ backgroundColor: "white", border: "1px solid #e7e9ed", borderRadius: "12px", overflow: "hidden" }}>

        {/* Toolbar */}
        <div style={{
          padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px",
          borderBottom: "1px solid #e7e9ed",
        }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#000", margin: 0 }}>
            Пользователи ({filtered.length})
          </h2>
          <div style={{
            flex: 1, maxWidth: "380px", marginLeft: "16px",
            display: "flex", alignItems: "center", gap: "8px",
            border: "1px solid #ddd", borderRadius: "8px", height: "38px", padding: "0 12px",
            backgroundColor: "#fafafa",
          }}>
            <span style={{ fontSize: "15px", opacity: 0.5 }}>🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по имени, email, группе..."
              style={{ border: "none", outline: "none", background: "transparent", fontSize: "14px", color: "#333", flex: 1 }}
            />
          </div>
          <button
            onClick={loadData}
            style={{
              marginLeft: "auto", height: "38px", padding: "0 16px",
              backgroundColor: "#f5f5ff", border: "1px solid #d2d0ff",
              borderRadius: "8px", fontSize: "14px", color: "#3525cd",
              cursor: "pointer", fontWeight: 500,
            }}
          >
            ↻ Обновить
          </button>
        </div>

        {/* Table header */}
        <div style={{
          display: "grid", gridTemplateColumns: "44px 2fr 2fr 1fr 100px 110px 90px",
          padding: "10px 20px", borderBottom: "1px solid #e7e9ed",
          backgroundColor: "#fafafa",
        }}>
          {["", "GitHub / Email", "Telegram", "Группа", "Прогресс", "Выполнено", ""].map((h, i) => (
            <span key={i} style={{ fontSize: "12px", fontWeight: 600, color: "#777", textTransform: "uppercase", letterSpacing: "0.4px" }}>
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <div style={{ padding: "60px", textAlign: "center", color: "#999", fontSize: "15px" }}>
            Загрузка пользователей...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "60px", textAlign: "center", color: "#999", fontSize: "15px" }}>
            {students.length === 0
              ? "Пользователи не найдены. Студенты регистрируются через Telegram бот."
              : "Ничего не найдено по запросу."}
          </div>
        ) : filtered.map((s, i) => {
          const initials = getInitials(s.github_alias || s.email.split("@")[0]);
          const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
          const progressColor = s.progress >= 70 ? "#16a34a" : s.progress >= 30 ? "#f59e0b" : "#e53e3e";

          return (
            <div
              key={s.tg_id}
              style={{
                display: "grid", gridTemplateColumns: "44px 2fr 2fr 1fr 100px 110px 90px",
                padding: "12px 20px", alignItems: "center",
                borderBottom: i < filtered.length - 1 ? "1px solid #f0eff5" : "none",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fafafe")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              {/* Avatar */}
              <div style={{
                width: "36px", height: "36px", borderRadius: "50%",
                backgroundColor: color,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "white" }}>{initials}</span>
              </div>

              {/* GitHub / Email */}
              <div>
                <p style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: 600, color: "#000" }}>
                  {s.github_alias || "—"}
                </p>
                <p style={{ margin: 0, fontSize: "12px", color: "#888" }}>{s.email}</p>
              </div>

              {/* Telegram */}
              <div>
                <p style={{ margin: "0 0 2px", fontSize: "14px", color: "#333" }}>
                  {s.tg_username || "—"}
                </p>
                {s.last_submission && (
                  <p style={{ margin: 0, fontSize: "11px", color: "#aaa" }}>
                    Посл. сдача: {s.last_submission}
                  </p>
                )}
              </div>

              {/* Group */}
              <span style={{ fontSize: "13px", color: "#555" }}>{s.student_group || "—"}</span>

              {/* Progress bar */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontSize: "12px", color: "#888" }}>Прогресс</span>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: progressColor }}>{s.progress}%</span>
                </div>
                <div style={{ width: "100%", height: "5px", backgroundColor: "#eee", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${s.progress}%`, backgroundColor: progressColor, borderRadius: "3px" }} />
                </div>
              </div>

              {/* Passed tasks */}
              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: "15px", fontWeight: 700, color: "#142175" }}>
                  {s.passed_tasks}
                </span>
                <span style={{ fontSize: "13px", color: "#aaa" }}> / {s.total_tasks}</span>
              </div>

              {/* Action */}
              <div>
                <Link
                  href={`/dashboard/students/${s.github_alias}`}
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    height: "32px", padding: "0 12px",
                    backgroundColor: "#f0f0ff", border: "1px solid #c5caff",
                    borderRadius: "7px", fontSize: "12px", color: "#3525cd",
                    textDecoration: "none", fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  Детали →
                </Link>
              </div>
            </div>
          );
        })}

        {/* Footer */}
        <div style={{
          padding: "12px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderTop: "1px solid #e7e9ed", backgroundColor: "#fafafa",
        }}>
          <span style={{ fontSize: "13px", color: "#888" }}>
            Показано {filtered.length} из {students.length} пользователей
          </span>
          <span style={{ fontSize: "12px", color: "#bbb" }}>
            Регистрация только через Telegram бот
          </span>
        </div>
      </div>

      {/* System info */}
      <div style={{
        marginTop: "20px",
        backgroundColor: "white", border: "1px solid #e7e9ed",
        borderRadius: "12px", padding: "20px 24px",
      }}>
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#000", margin: "0 0 14px" }}>
          ℹ️ Информация о системе
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
          {[
            { label: "Бэкенд", value: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000" },
            { label: "Студентов в БД", value: String(students.length) },
            { label: "Регистрация",   value: "Через Telegram бот" },
          ].map((item) => (
            <div key={item.label} style={{ padding: "12px 16px", backgroundColor: "#f8f8ff", borderRadius: "8px" }}>
              <p style={{ fontSize: "12px", color: "#888", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                {item.label}
              </p>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "#333", margin: 0, fontFamily: "monospace" }}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
