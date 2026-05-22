"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getStudents, getStudentDetails } from "@/lib/api";

interface StudentRow {
  id: number;
  email: string;
  full_name: string | null;
  tg_id: number | null;
  created_at: string;
  progress?: number;
  avg_score?: number;
  passed_tasks?: number;
  total_tasks?: number;
}

interface SubMark {
  id: number;
  assignment_title?: string;
  assignment_id: number;
  score: number | null;
  pass_fail: "pass" | "fail" | null;
  status: string;
}

type StudentStatus = "active" | "stuck" | "needs_help";

function getStatus(s: StudentRow): StudentStatus {
  const p = s.progress ?? 0;
  if (p >= 70) return "active";
  if (p >= 30) return "needs_help";
  return "stuck";
}

const STATUS_INFO: Record<StudentStatus, { label: string; bg: string; color: string }> = {
  active:     { label: "Активен",      bg: "#dcfce7", color: "#15803d" },
  stuck:      { label: "В стопоре",    bg: "#fee2e2", color: "#b91c1c" },
  needs_help: { label: "Нужна помощь", bg: "#ffedd5", color: "#c2410c" },
};

function displayName(s: StudentRow) {
  return s.full_name || s.email.split("@")[0];
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

export default function StudentsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | StudentStatus>("all");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [marksCache, setMarksCache] = useState<Record<number, SubMark[]>>({});
  const [marksLoading, setMarksLoading] = useState<Record<number, boolean>>({});
  const router = useRouter();

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

  const loadStudents = useCallback(() => {
    setLoading(true);
    getStudents()
      .then((r) => (r.ok ? r.json() : []))
      .then((data: StudentRow[]) => setStudents(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const filtered = students.filter((s) => {
    const name = displayName(s).toLowerCase();
    const matchSearch = name.includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || getStatus(s) === filter;
    return matchSearch && matchFilter;
  });

  const totalCount  = students.length;
  const activeCount = students.filter((s) => getStatus(s) === "active").length;
  const stuckCount  = students.filter((s) => getStatus(s) === "stuck").length;

  return (
    <div style={{ backgroundColor: "var(--color-bg-alt)", minHeight: "100%" }}>
      {/* Page header */}
      <div style={{ padding: "36px 40px 0" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px" }}>
          <div>
            <h1 style={{ fontSize: "36px", fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 8px" }}>
              Студенты
            </h1>
            <p style={{ fontSize: "15px", color: "var(--color-text-muted)", margin: 0, maxWidth: "380px", lineHeight: "1.5" }}>
              Управление списком студентов и мониторинг их успеваемости.
            </p>
          </div>

          {/* Mini stat cards */}
          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{
              backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
              borderRadius: "10px", padding: "12px 20px", minWidth: "130px",
            }}>
              <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", margin: "0 0 8px", letterSpacing: "0.5px" }}>
                Всего студентов
              </p>
              <p style={{ fontSize: "28px", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>{totalCount}</p>
            </div>
            <div style={{
              backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
              borderRadius: "10px", padding: "12px 20px", minWidth: "130px",
            }}>
              <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", margin: "0 0 8px", letterSpacing: "0.5px" }}>
                Активные
              </p>
              <p style={{ fontSize: "28px", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>{activeCount}</p>
            </div>
            <div style={{
              backgroundColor: "#fff1f2", border: "1px solid #fecdd3",
              borderRadius: "10px", padding: "12px 20px", minWidth: "130px",
            }}>
              <p style={{ fontSize: "11px", fontWeight: 600, color: "#b91c1c", textTransform: "uppercase", margin: "0 0 8px", letterSpacing: "0.5px" }}>
                В стопоре
              </p>
              <p style={{ fontSize: "28px", fontWeight: 700, color: "#b91c1c", margin: 0 }}>{stuckCount}</p>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "16px" }}>
          <div style={{
            flex: 1, backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
            borderRadius: "10px", height: "44px",
            display: "flex", alignItems: "center", gap: "10px", padding: "0 14px",
          }}>
            <span style={{ fontSize: "16px", color: "var(--color-text-muted)" }}>🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по имени..."
              style={{ border: "none", outline: "none", background: "transparent", fontSize: "14px", color: "var(--color-text-primary)", flex: 1 }}
            />
          </div>

          <div style={{
            backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
            borderRadius: "10px", height: "44px",
            display: "flex", alignItems: "center", padding: "0 14px", gap: "8px", minWidth: "170px",
          }}>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as "all" | StudentStatus)}
              style={{ border: "none", outline: "none", background: "transparent", fontSize: "14px", color: "var(--color-text-primary)", flex: 1, cursor: "pointer" }}
            >
              <option value="all">Все статусы</option>
              <option value="active">Активен</option>
              <option value="needs_help">Нужна помощь</option>
              <option value="stuck">В стопоре</option>
            </select>
            <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>▼</span>
          </div>
        </div>
      </div>

      {/* Student list */}
      <div style={{ padding: "0 40px 40px" }}>
        {loading ? (
          <div style={{ padding: "60px", textAlign: "center", color: "var(--color-text-subtle)", fontSize: "16px" }}>
            Загрузка студентов...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
            borderRadius: "12px", padding: "48px",
            textAlign: "center", color: "var(--color-text-subtle)", fontSize: "15px",
          }}>
            {students.length === 0
              ? "Студентов пока нет. Администратор должен добавить их в систему."
              : "Студенты не найдены."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {filtered.map((s, i) => {
              const status = getStatus(s);
              const statusInfo = STATUS_INFO[status];
              const progress = s.progress ?? 0;
              const progressColor =
                status === "active" ? "#142175" :
                status === "stuck"  ? "#b91c1c" : "#f59e0b";
              const name = displayName(s);
              const initials = getInitials(name);
              const isExpanded = expandedId === s.id;
              const marks: SubMark[] = marksCache[s.id] ?? [];
              const isLoadingMarks = marksLoading[s.id];
              const avgGrade = s.avg_score != null ? (s.avg_score / 20).toFixed(1) : "—";
              const totalPoints = s.passed_tasks != null && s.avg_score != null
                ? Math.round(s.passed_tasks * s.avg_score * 10)
                : 0;

              return (
                <div
                  key={s.id}
                  style={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border-card)",
                    borderRadius: "12px", overflow: "hidden",
                  }}
                >
                  {/* Main row */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 180px 200px 160px 44px",
                    alignItems: "center",
                    padding: "16px 20px",
                    gap: "16px",
                  }}>
                    {/* Avatar + Name */}
                    <div
                      onClick={() => router.push(`/dashboard/students/${s.id}`)}
                      style={{ display: "flex", alignItems: "center", gap: "14px", cursor: "pointer" }}
                    >
                      <div style={{
                        width: "48px", height: "48px", borderRadius: "50%",
                        backgroundColor: "#f0f0f5", flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <span style={{ fontSize: "17px", fontWeight: 700, color: "#6b6b8a" }}>{initials}</span>
                      </div>
                      <div>
                        <p style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 3px" }}>
                          {name}
                        </p>
                        <p style={{ fontSize: "12px", color: "var(--color-text-subtle)", margin: 0 }}>
                          🎓 {s.email}
                        </p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                        <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Прогресс</span>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: progressColor }}>{progress}%</span>
                      </div>
                      <div style={{ height: "6px", backgroundColor: "var(--color-border)", borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${progress}%`, backgroundColor: progressColor, borderRadius: "3px" }} />
                      </div>
                    </div>

                    {/* Scores */}
                    <div>
                      <p style={{ fontSize: "11px", color: "var(--color-text-muted)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.3px" }}>
                        Средние / Общие баллы
                      </p>
                      <p style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
                        {avgGrade}{" "}
                        <span style={{ fontSize: "14px", color: "var(--color-text-muted)", fontWeight: 400 }}>
                          / {totalPoints}
                        </span>
                      </p>
                    </div>

                    {/* Status badge */}
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <span style={{
                        fontSize: "12px", fontWeight: 600, padding: "5px 14px", borderRadius: "20px",
                        backgroundColor: statusInfo.bg, color: statusInfo.color, whiteSpace: "nowrap",
                      }}>
                        {statusInfo.label}
                      </span>
                    </div>

                    {/* Expand button */}
                    <button
                      onClick={() => toggleExpand(s.id)}
                      style={{
                        width: "36px", height: "36px", borderRadius: "8px",
                        backgroundColor: isExpanded ? "var(--color-accent)" : "var(--color-bg-alt)",
                        border: `1px solid ${isExpanded ? "var(--color-accent)" : "var(--color-border-input)"}`,
                        color: isExpanded ? "white" : "var(--color-text-muted)",
                        fontSize: "18px", fontWeight: 700, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      {isExpanded ? "−" : "+"}
                    </button>
                  </div>

                  {/* Expanded marks */}
                  {isExpanded && (
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
                            const bg = isPending ? "#eef2ff" : isPassed ? "#dcfce7" : "#fee2e2";
                            const color = isPending ? "#3730a3" : isPassed ? "#15803d" : "#b91c1c";
                            const border = isPending ? "#c7d2fe" : isPassed ? "#bbf7d0" : "#fecaca";
                            const label = m.assignment_title || `Задание #${m.assignment_id}`;
                            return (
                              <div key={m.id} style={{
                                display: "flex", alignItems: "center", gap: "8px",
                                backgroundColor: bg, border: `1px solid ${border}`,
                                borderRadius: "8px", padding: "6px 12px",
                              }}>
                                <span style={{ fontSize: "13px", color: "var(--color-text-primary)", fontWeight: 500 }}>
                                  {label}
                                </span>
                                <span style={{
                                  fontSize: "12px", fontWeight: 700, color,
                                  backgroundColor: "white", borderRadius: "5px",
                                  padding: "2px 7px",
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
        )}
      </div>
    </div>
  );
}
