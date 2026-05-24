"use client";

import { useEffect, useState } from "react";
import { getStudents, getStudentDetails, getToken } from "@/lib/api";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface StudentRow {
  id: number;
  email: string;
  full_name: string | null;
  avg_score?: number;
  passed_tasks?: number;
}

interface LeaderEntry {
  rank: number;
  name: string;
  email: string;
  initials: string;
  points: number;
  solved: number;
  id: number;
  trend: string;
}

interface SubMark {
  id: number;
  assignment_title?: string;
  assignment_id: number;
  score: number | null;
  pass_fail: "pass" | "fail" | null;
  status: string;
}

const AVATAR_COLORS = [
  "#1976d2", "#e91e63", "#4caf50", "#9c27b0", "#ff9800",
  "#f44336", "#00bcd4", "#795548", "#607d8b", "#3f51b5",
];

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "up")   return <span style={{ fontSize: "18px", color: "#16a34a" }}>↑</span>;
  if (trend === "down") return <span style={{ fontSize: "18px", color: "#dc2626" }}>↓</span>;
  return <span style={{ fontSize: "18px", color: "#9ca3af" }}>→</span>;
}

export default function Top10Page() {
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [marksCache, setMarksCache] = useState<Record<number, SubMark[]>>({});
  const [marksLoading, setMarksLoading] = useState<Record<number, boolean>>({});
  const isStudent = typeof window !== "undefined"
    && (sessionStorage.getItem("user_role") || localStorage.getItem("user_role")) === "student";

  async function toggleExpand(studentId: number) {
    if (expandedId === studentId) { setExpandedId(null); return; }
    setExpandedId(studentId);
    if (marksCache[studentId]) return;
    setMarksLoading((prev) => ({ ...prev, [studentId]: true }));
    try {
      const res = await getStudentDetails(studentId);
      if (res.ok) {
        const data = await res.json();
        setMarksCache((prev) => ({ ...prev, [studentId]: data.submissions ?? [] }));
      }
    } finally {
      setMarksLoading((prev) => ({ ...prev, [studentId]: false }));
    }
  }

  useEffect(() => {
    const role = sessionStorage.getItem("user_role") || localStorage.getItem("user_role");
    const token = getToken();

    const fetchData = role === "student"
      ? fetch(`${BASE_URL}/student/leaderboard`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
          .then((r) => r.ok ? r.json() : [])
      : getStudents().then((r) => r.ok ? r.json() : []);

    fetchData
      .then((data: StudentRow[]) => {
        if (!Array.isArray(data)) return;
        const entries: LeaderEntry[] = data
          .slice(0, 10)
          .map((s, i) => {
            const name = (s.full_name || s.email.split("@")[0]).trim();
            const parts = name.split(/\s+/);
            const initials = parts.length >= 2
              ? (parts[0][0] + parts[1][0]).toUpperCase()
              : name.slice(0, 2).toUpperCase();
            const points = Math.round((s.avg_score ?? 0) * (s.passed_tasks ?? 0));
            return {
              rank: i + 1,
              name,
              email: s.email,
              initials,
              points,
              solved: s.passed_tasks ?? 0,
              id: s.id,
              trend: "stable",
            };
          });
        setLeaderboard(entries);
      })
      .finally(() => setLoading(false));
  }, []);

  const leader = leaderboard[0] ?? null;

  if (loading) {
    return (
      <div style={{ padding: "60px 45px", textAlign: "center", color: "var(--color-text-subtle)", fontSize: "18px" }}>
        Загрузка...
      </div>
    );
  }

  return (
    <div style={{ padding: "43px 45px", backgroundColor: "var(--color-bg)", minHeight: "100%" }}>
      {/* Header */}
      <h1 style={{ fontSize: "40px", fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 8px" }}>
        Рейтинг студентов: TOP-10
      </h1>
      <p style={{ fontSize: "18px", color: "var(--color-text-muted)", margin: "0 0 32px", fontWeight: 400 }}>
        Академическая успеваемость и активность
      </p>

      {leaderboard.length === 0 ? (
        <div style={{
          backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
          borderRadius: "13px", padding: "60px",
          textAlign: "center", color: "var(--color-text-subtle)", fontSize: "18px",
        }}>
          Данных пока нет. Студенты начнут появляться после первых сдач.
        </div>
      ) : (
        <div style={{ display: "flex", gap: "22px", alignItems: "flex-start" }}>
          {/* Leader card */}
          {leader && (
            <div style={{
              width: "336px", flexShrink: 0,
              backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
              borderRadius: "11px", padding: "24px",
              display: "flex", flexDirection: "column", alignItems: "center",
              minHeight: "400px",
            }}>
              <span style={{ fontSize: "40px", marginBottom: "12px" }}>🏆</span>
              <p style={{ fontSize: "24px", fontWeight: 600, color: "var(--color-accent)", margin: "0 0 32px" }}>
                Лидер месяца
              </p>

              <div style={{
                width: "112px", height: "112px", borderRadius: "50%",
                backgroundColor: AVATAR_COLORS[0],
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: "24px",
              }}>
                <span style={{ fontSize: "40px", fontWeight: 700, color: "white" }}>{leader.initials}</span>
              </div>

              <p style={{ fontSize: "27px", fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 6px" }}>
                {leader.name}
              </p>
              <p style={{ fontSize: "16px", color: "var(--color-text-muted)", margin: "0 0 4px" }}>
                {leader.points.toLocaleString("ru")} баллов
              </p>
              <p style={{ fontSize: "14px", color: "var(--color-text-subtle)", margin: 0 }}>
                Решено задач: {leader.solved}
              </p>
            </div>
          )}

          {/* Leaderboard table */}
          <div style={{
            flex: 1,
            backgroundColor: "var(--color-card)",
            border: "2px solid var(--color-border-light)",
            borderRadius: "10px",
            overflow: "hidden",
          }}>
            {/* Table header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "60px 48px 1fr 130px 140px 60px 44px",
              padding: "8px 20px",
              borderBottom: "1px solid var(--color-border-light)",
            }}>
              {["Ранг", "", "Студент", "Общий балл", "Сдано задач", "Тренд", ""].map((h, i) => (
                <p key={i} style={{ fontSize: "14px", fontWeight: 500, color: "var(--color-text-muted)", margin: 0, padding: "8px 0" }}>
                  {h}
                </p>
              ))}
            </div>

            {/* Table rows */}
            {leaderboard.map((row, i) => {
              const isExpanded = expandedId === row.id;
              const marks: SubMark[] = marksCache[row.id] ?? [];
              const isLoadingMarks = marksLoading[row.id];
              return (
                <div key={row.id || i} style={{ borderBottom: i < leaderboard.length - 1 ? "1px solid var(--color-border)" : "none" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "60px 48px 1fr 130px 140px 60px 44px",
                      padding: "0 20px",
                      alignItems: "center",
                      minHeight: "69px",
                      backgroundColor: i === 0 ? "var(--color-card-alt)" : "transparent",
                    }}
                  >
                    {/* Rank */}
                    <span style={{ fontSize: "16px", fontWeight: 700, color: i < 3 ? "var(--color-accent)" : "var(--color-text-muted)" }}>
                      {row.rank}
                    </span>

                    {/* Avatar */}
                    <div style={{
                      width: "38px", height: "38px", borderRadius: "50%",
                      backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "white" }}>{row.initials}</span>
                    </div>

                    {/* Name */}
                    <span style={{ fontSize: "17px", fontWeight: 600, color: "var(--color-text-primary)", paddingLeft: "8px" }}>
                      {row.name}
                    </span>

                    {/* Points */}
                    <span style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text-primary)" }}>
                      {row.points.toLocaleString("ru")}
                    </span>

                    {/* Solved */}
                    <span style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text-light)" }}>
                      {row.solved}
                    </span>

                    {/* Trend */}
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <TrendIcon trend={row.trend} />
                    </div>

                    {/* Expand button — teachers only */}
                    {!isStudent ? (
                      <button
                        onClick={() => toggleExpand(row.id)}
                        title={isExpanded ? "Скрыть оценки" : "Показать оценки"}
                        style={{
                          width: "32px", height: "32px", borderRadius: "7px",
                          backgroundColor: isExpanded ? "var(--color-accent)" : "var(--color-bg-alt)",
                          border: `1px solid ${isExpanded ? "var(--color-accent)" : "var(--color-border-input)"}`,
                          color: isExpanded ? "white" : "var(--color-text-muted)",
                          fontSize: "18px", fontWeight: 700, cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        {isExpanded ? "−" : "+"}
                      </button>
                    ) : <span />}
                  </div>

                  {/* Inline marks panel — teachers only */}
                  {!isStudent && isExpanded && (
                    <div style={{
                      borderTop: "1px solid var(--color-border-card)",
                      backgroundColor: "var(--color-bg-alt)",
                      padding: "14px 20px",
                    }}>
                      {isLoadingMarks ? (
                        <span style={{ fontSize: "13px", color: "var(--color-text-subtle)" }}>Загрузка оценок...</span>
                      ) : marks.length === 0 ? (
                        <span style={{ fontSize: "13px", color: "var(--color-text-subtle)" }}>Работы ещё не сданы.</span>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                          {marks.map((m) => {
                            const scoreNum = m.score != null ? Math.round(m.score * 100) : null;
                            const isPassed = m.pass_fail === "pass";
                            const isPending = m.status !== "done";
                            const bg = isPending ? "#eef2ff" : isPassed ? "#ecfdf5" : "#fef2f2";
                            const color = isPending ? "#3332ce" : isPassed ? "#0e3e12" : "#8f0000";
                            const borderColor = isPending ? "#c5caff" : isPassed ? "#b5f5d7" : "#fec7c7";
                            const label = m.assignment_title || `Задание #${m.assignment_id}`;
                            return (
                              <div key={m.id} style={{
                                display: "flex", alignItems: "center", gap: "8px",
                                backgroundColor: bg, border: `1px solid ${borderColor}`,
                                borderRadius: "8px", padding: "6px 12px",
                              }}>
                                <span style={{ fontSize: "13px", color: "var(--color-text-primary)", fontWeight: 500 }}>
                                  {label}
                                </span>
                                <span style={{
                                  fontSize: "13px", fontWeight: 700, color,
                                  backgroundColor: "white", borderRadius: "6px",
                                  padding: "2px 8px", minWidth: "36px", textAlign: "center",
                                }}>
                                  {isPending ? "…" : scoreNum != null ? `${scoreNum}%` : "—"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
