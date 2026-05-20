"use client";

import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getStudents } from "@/lib/api";

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

type StudentStatus = "active" | "stuck" | "needs_help";

function getStatus(s: StudentRow): StudentStatus {
  if (s.progress >= 70) return "active";
  if (s.progress >= 30) return "needs_help";
  return "stuck";
}

const STATUS_LABELS: Record<StudentStatus, { label: string; bg: string; border: string; color: string }> = {
  active:      { label: "Активен",       bg: "#ecfdf5", border: "#b5f5d7", color: "#0e3e12" },
  stuck:       { label: "В стопоре",     bg: "#fef2f2", border: "#fec7c7", color: "#8f0000" },
  needs_help:  { label: "Нужна помощь",  bg: "#fffbeb", border: "#fde372", color: "#af3f00" },
};

export default function StudentsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | StudentStatus>("all");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadStudents = useCallback(() => {
    setLoading(true);
    getStudents()
      .then((r) => (r.ok ? r.json() : []))
      .then((data: StudentRow[]) => setStudents(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const filtered = students.filter((s) => {
    const matchSearch =
      s.github_alias.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      (s.tg_username || "").toLowerCase().includes(search.toLowerCase());
    const status = getStatus(s);
    const matchFilter = filter === "all" || status === filter;
    return matchSearch && matchFilter;
  });

  const totalCount  = students.length;
  const activeCount = students.filter((s) => getStatus(s) === "active").length;
  const stuckCount  = students.filter((s) => getStatus(s) === "stuck").length;

  return (
    <div style={{ padding: "43px 45px", backgroundColor: "var(--color-bg-alt)", minHeight: "100%" }}>

      {/* Top bar */}
      <div style={{
        position: "absolute", top: 0, left: "288px", right: 0,
        height: "70px", backgroundColor: "var(--color-topbar)",
        borderBottom: "1px solid var(--color-border)",
        display: "flex", alignItems: "center", padding: "0 45px", gap: "16px",
      }}>
        <div style={{
          flex: 1, maxWidth: "504px", backgroundColor: "var(--color-card-input)",
          borderRadius: "8px", height: "43px",
          display: "flex", alignItems: "center", gap: "10px", padding: "0 14px",
        }}>
          <Image src="/assets/icons/search-icon.png" alt="" width={22} height={22} className="object-contain" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск студентов..."
            style={{ border: "none", outline: "none", background: "transparent", fontSize: "16px", color: "var(--color-text-muted)", flex: 1 }}
          />
        </div>
        <div style={{ marginLeft: "auto" }}>
          <Image src="/assets/icons/doorbell-icon.png" alt="" width={26} height={26} className="object-contain" />
        </div>
      </div>

      <div style={{ paddingTop: "90px" }}>
        {/* Header + stats */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px" }}>
          <div>
            <h1 style={{ fontSize: "38.5px", fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 8px" }}>Студенты</h1>
            <p style={{ fontSize: "18px", color: "var(--color-text-muted)", margin: 0, maxWidth: "440px", lineHeight: "1.45" }}>
              Управление списком студентов и мониторинг их успеваемости.
            </p>
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{ backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)", borderRadius: "8px", padding: "14px 20px", width: "158px" }}>
              <p style={{ fontSize: "14px", color: "var(--color-text-primary)", textTransform: "uppercase", margin: "0 0 12px", lineHeight: "1.2" }}>Всего студентов</p>
              <p style={{ fontSize: "27px", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>{totalCount}</p>
            </div>
            <div style={{ backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)", borderRadius: "8px", padding: "14px 20px", width: "158px" }}>
              <p style={{ fontSize: "14px", color: "var(--color-text-primary)", textTransform: "uppercase", margin: "0 0 12px" }}>Активные</p>
              <p style={{ fontSize: "27px", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>{activeCount}</p>
            </div>
            <div style={{ backgroundColor: "#fcf2f7", border: "1px solid #ecc0c3", borderRadius: "8px", padding: "14px 20px", width: "158px" }}>
              <p style={{ fontSize: "14px", color: "#bb2526", textTransform: "uppercase", margin: "0 0 12px" }}>В стопоре</p>
              <p style={{ fontSize: "27px", fontWeight: 700, color: "#bb2526", margin: 0 }}>{stuckCount}</p>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div style={{
          backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
          borderRadius: "9px", padding: "20px 22px",
          display: "flex", gap: "14px", alignItems: "center",
          marginBottom: "14px",
        }}>
          <div style={{
            flex: 1, backgroundColor: "var(--color-bg-alt)",
            border: "1px solid var(--color-border-input)", borderRadius: "8px",
            height: "44px", display: "flex", alignItems: "center", gap: "10px", padding: "0 14px",
          }}>
            <Image src="/assets/icons/search-icon.png" alt="" width={21} height={21} className="object-contain" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по имени или email..."
              style={{ border: "none", outline: "none", background: "transparent", fontSize: "16px", color: "var(--color-text-primary)", flex: 1 }}
            />
          </div>

          <div style={{
            backgroundColor: "var(--color-bg-alt)", border: "1px solid var(--color-border-input)",
            borderRadius: "8px", height: "44px",
            display: "flex", alignItems: "center", padding: "0 14px", gap: "8px", minWidth: "185px",
          }}>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as "all" | StudentStatus)}
              style={{ border: "none", outline: "none", background: "transparent", fontSize: "16px", color: "var(--color-text-primary)", flex: 1, cursor: "pointer", WebkitAppearance: "none", appearance: "none" }}
            >
              <option value="all">Все статусы</option>
              <option value="active">Активен</option>
              <option value="needs_help">Нужна помощь</option>
              <option value="stuck">В стопоре</option>
            </select>
            <Image src="/assets/icons/expand-arrow.png" alt="" width={18} height={18} className="object-contain" style={{ pointerEvents: "none", flexShrink: 0 }} />
          </div>
        </div>

        {/* Student rows */}
        {loading ? (
          <div style={{ padding: "48px", textAlign: "center", color: "var(--color-text-subtle)", fontSize: "16px" }}>
            Загрузка студентов...
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {filtered.length === 0 && (
              <div style={{
                backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
                borderRadius: "9px", padding: "48px",
                textAlign: "center", color: "var(--color-text-subtle)", fontSize: "16px",
              }}>
                {students.length === 0
                  ? "Студентов пока нет. Они регистрируются через Telegram бот."
                  : "Студенты не найдены."}
              </div>
            )}

            {filtered.map((s) => {
              const status = getStatus(s);
              const statusInfo = STATUS_LABELS[status];
              const progressColor =
                status === "active" ? "var(--color-progress-active)" :
                status === "stuck"  ? "#ba1a1a" : "#f59e0b";
              const initials = (s.github_alias || s.email).slice(0, 2).toUpperCase();

              return (
                <div
                  key={s.tg_id}
                  style={{
                    backgroundColor: "var(--color-card)",
                    border: `1px solid ${status === "stuck" ? "#efcbca" : "var(--color-border-card)"}`,
                    borderRadius: "9px",
                  }}
                >
                  <div style={{ padding: "0 22px", height: "96px", display: "flex", alignItems: "center", gap: "20px" }}>
                    {/* Avatar + Name */}
                    <div
                      onClick={() => router.push(`/dashboard/students/${s.github_alias}`)}
                      style={{ display: "flex", alignItems: "center", gap: "14px", cursor: "pointer", flexShrink: 0 }}
                    >
                      <div style={{
                        width: "55px", height: "55px", borderRadius: "50%",
                        backgroundColor: "#e8e4f0",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>
                        <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-accent)" }}>{initials}</span>
                      </div>
                      <div style={{ width: "170px" }}>
                        <p style={{
                          fontSize: "17px", fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 4px",
                          textDecoration: "underline", textDecorationColor: "transparent", transition: "text-decoration-color 0.15s",
                        }}
                          onMouseEnter={(e) => (e.currentTarget.style.textDecorationColor = "var(--color-accent)")}
                          onMouseLeave={(e) => (e.currentTarget.style.textDecorationColor = "transparent")}
                        >
                          {s.github_alias || s.email.split("@")[0]}
                        </p>
                        <span style={{ fontSize: "13px", color: "var(--color-text-subtle)" }}>
                          {s.tg_username || s.email}
                        </span>
                      </div>
                    </div>

                    <div style={{ width: "1px", height: "53px", backgroundColor: "var(--color-border-card)", flexShrink: 0 }} />

                    {/* Progress */}
                    <div style={{ width: "200px", flexShrink: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                        <span style={{ fontSize: "13px", color: "var(--color-text-light)" }}>Прогресс</span>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: status === "active" ? "var(--color-accent)" : "var(--color-text-muted)" }}>
                          {s.progress}%
                        </span>
                      </div>
                      <div style={{ width: "100%", height: "7px", backgroundColor: "var(--color-border)", borderRadius: "3.5px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${s.progress}%`, backgroundColor: progressColor, borderRadius: "3.5px" }} />
                      </div>
                    </div>

                    <div style={{ width: "1px", height: "53px", backgroundColor: "var(--color-border-card)", flexShrink: 0 }} />

                    {/* Scores */}
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: "13px", color: "var(--color-text-light)", margin: "0 0 4px" }}>Выполнено / Средний балл</p>
                      <p style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
                        {s.passed_tasks}/{s.total_tasks}&nbsp;&nbsp;·&nbsp;&nbsp;{s.avg_score}%
                      </p>
                    </div>

                    <div style={{ width: "1px", height: "53px", backgroundColor: "var(--color-border-card)", flexShrink: 0 }} />

                    {/* Status badge */}
                    <div style={{ width: "148px", display: "flex", justifyContent: "center" }}>
                      <span style={{
                        backgroundColor: statusInfo.bg, border: `1px solid ${statusInfo.border}`,
                        borderRadius: "14px", padding: "5px 14px",
                        fontSize: "13px", fontWeight: 600, color: statusInfo.color, whiteSpace: "nowrap",
                      }}>
                        {statusInfo.label}
                      </span>
                    </div>

                    {/* Detail link */}
                    <button
                      onClick={() => router.push(`/dashboard/students/${s.github_alias}`)}
                      style={{
                        backgroundColor: "var(--color-btn-primary-bg)", color: "var(--color-btn-primary-color)",
                        border: "none", borderRadius: "8px", height: "36px", padding: "0 18px",
                        fontSize: "14px", fontWeight: 500, cursor: "pointer", flexShrink: 0,
                      }}
                    >
                      Подробнее
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
