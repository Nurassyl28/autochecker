"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getStudents, getMyData } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface StudentRow {
  id: number;
  email: string;
  full_name: string | null;
  tg_id: number | null;
  progress?: number;
  avg_score?: number;
  passed_tasks?: number;
  total_tasks?: number;
}

interface Assignment {
  id: number;
  title: string;
  description_text: string | null;
  spec_status: string;
  created_at: string;
}

interface Submission {
  id: number;
  assignment_id: number;
  status: string;
  pass_fail: "pass" | "fail" | null;
  score: number | null;
  feedback_json: Record<string, unknown> | null;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function displayName(s: StudentRow) {
  return s.full_name || s.email.split("@")[0];
}

function getTaskStatus(sub?: Submission): "none" | "in_progress" | "passed" | "failed" {
  if (!sub) return "none";
  if (sub.status === "done" && sub.pass_fail === "pass") return "passed";
  if (sub.status === "done" && sub.pass_fail === "fail") return "failed";
  return "in_progress";
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

const AVATAR_PALETTE = [
  { bg: "#e8e4f0", color: "#5566cc" },
  { bg: "#fce4ec", color: "#c62828" },
  { bg: "#e3f2fd", color: "#1565c0" },
  { bg: "#e8f5e9", color: "#2e7d32" },
  { bg: "#fff3e0", color: "#e65100" },
  { bg: "#f3e5f5", color: "#6a1b9a" },
];

// ── Student Dashboard ──────────────────────────────────────────────────────────

function StudentHome() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyData()
      .then(({ assignments: a, submissions: s }) => {
        setAssignments(Array.isArray(a) ? (a as Assignment[]) : []);
        setSubmissions(Array.isArray(s) ? (s as Submission[]) : []);
      })
      .finally(() => setLoading(false));
  }, []);

  const name = (typeof window !== "undefined" ? sessionStorage.getItem("user_name") : null) || "Студент";

  const allSubsForAssignment = (assignmentId: number): Submission[] =>
    submissions
      .filter((s) => s.assignment_id === assignmentId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const latestSub = (assignmentId: number): Submission | undefined =>
    allSubsForAssignment(assignmentId)[0];

  const passedCount = assignments.filter((a) => latestSub(a.id)?.pass_fail === "pass").length;
  const inProgressCount = assignments.filter((a) => {
    const sub = latestSub(a.id);
    return sub && sub.status !== "done";
  }).length;

  const doneScores = submissions.filter((s) => s.status === "done" && s.score != null).map((s) => s.score as number);
  const avgScore = doneScores.length ? Math.round((doneScores.reduce((a, b) => a + b, 0) / doneScores.length) * 100) : 0;
  const progress = assignments.length > 0 ? Math.round((passedCount / assignments.length) * 100) : 0;
  const starRating = passedCount * 100 + avgScore;

  if (loading) {
    return (
      <div style={{ padding: "60px 45px", textAlign: "center", color: "var(--color-text-subtle)", fontSize: "18px" }}>
        Загрузка...
      </div>
    );
  }

  return (
    <div style={{ padding: "40px 48px", backgroundColor: "var(--color-bg)", minHeight: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "32px" }}>
        <div>
          <h1 style={{ fontSize: "38px", fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 8px" }}>
            С возвращением, {name.split(" ")[0]}!
          </h1>
          <p style={{ fontSize: "16px", color: "var(--color-text-muted)", margin: 0 }}>
            {assignments.length > 0
              ? `Продолжайте обучение. У вас ${assignments.length} задан${assignments.length === 1 ? "ие" : "ий"} в курсе.`
              : "Задания не назначены. Обратитесь к преподавателю."}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          <span style={{ fontSize: "28px" }}>★</span>
          <span style={{ fontSize: "28px", fontWeight: 700, color: "var(--color-text-primary)" }}>
            {starRating}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: "24px" }}>
        {/* Assignments list */}
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "16px", color: "var(--color-text-primary)" }}>
            Ваши задания
          </h2>

          {assignments.length === 0 ? (
            <div style={{
              backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
              borderRadius: "12px", padding: "40px 24px", textAlign: "center", color: "var(--color-text-subtle)", fontSize: "16px",
            }}>
              Задания не найдены. Дождитесь назначения от преподавателя.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {assignments.map((a) => {
                const sub = latestSub(a.id);
                const taskStatus = getTaskStatus(sub);
                const score = sub?.score != null ? Math.round(sub.score * 10) : null;

                const isPassed = taskStatus === "passed";
                const isFailed = taskStatus === "failed";
                const isInProgress = taskStatus === "in_progress";

                const cardStyle: React.CSSProperties = {
                  backgroundColor: isFailed ? "#fff5f5" : "var(--color-card)",
                  border: isFailed ? "1px solid #fcd0d0" : "1px solid var(--color-border-card)",
                  borderLeft: isFailed ? "4px solid #e53e3e" : "1px solid var(--color-border-card)",
                  borderRadius: "12px",
                  padding: "18px 20px",
                  cursor: sub ? "pointer" : "default",
                };

                const feedbackText = sub?.feedback_json
                  ? typeof sub.feedback_json === "object" && "summary" in sub.feedback_json
                    ? String(sub.feedback_json.summary)
                    : null
                  : null;

                  const allSubs = allSubsForAssignment(a.id);
                return (
                  <div key={a.id} style={{ ...cardStyle, cursor: "default" }}>
                    {/* Top row: status badge + date */}
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
                      {taskStatus === "none" && (
                        <span style={{ fontSize: "12px", fontWeight: 600, padding: "3px 12px", borderRadius: "20px", backgroundColor: "#f3f4f6", color: "#6b7280" }}>
                          Не начато
                        </span>
                      )}
                      {isInProgress && (
                        <span style={{ fontSize: "12px", fontWeight: 600, padding: "3px 12px", borderRadius: "20px", backgroundColor: "#eef2ff", color: "#3730a3" }}>
                          ⏳ В процессе
                        </span>
                      )}
                      {isFailed && (
                        <span style={{ fontSize: "12px", fontWeight: 600, padding: "3px 12px", borderRadius: "20px", backgroundColor: "#fee2e2", color: "#b91c1c" }}>
                          ⚠️ Нужно исправить
                        </span>
                      )}
                      {isPassed && (
                        <span style={{ fontSize: "12px", fontWeight: 600, padding: "3px 12px", borderRadius: "20px", backgroundColor: "#dcfce7", color: "#15803d" }}>
                          ✅ Выполнено
                        </span>
                      )}
                      {isPassed && score != null && (
                        <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                          🕐 Оценка: {score}/10
                        </span>
                      )}
                      {isFailed && sub && (
                        <span style={{ fontSize: "12px", color: "#b91c1c" }}>
                          ⚠️ Требует доработки
                        </span>
                      )}
                      {isInProgress && sub && (
                        <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                          🕐 {new Date(sub.created_at).toLocaleDateString("ru-RU")}
                        </span>
                      )}
                    </div>

                    {/* Title + action */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
                      <div style={{ flex: 1 }}>
                        <p style={{
                          fontSize: "17px", fontWeight: 600, margin: "0 0 4px",
                          color: isPassed ? "var(--color-text-muted)" : "var(--color-text-primary)",
                          textDecoration: isPassed ? "line-through" : "none",
                        }}>
                          {a.title}
                        </p>
                        {isFailed && feedbackText && (
                          <p style={{ fontSize: "13px", color: "#b91c1c", margin: 0, lineHeight: "1.45" }}>
                            {feedbackText.slice(0, 200)}{feedbackText.length > 200 ? "..." : ""}
                          </p>
                        )}
                        {isFailed && !feedbackText && (
                          <p style={{ fontSize: "13px", color: "#b91c1c", margin: 0 }}>
                            AI-тьютор обнаружил ошибки. Нажмите для подробностей.
                          </p>
                        )}
                        {taskStatus === "none" && a.description_text && (
                          <p style={{ fontSize: "13px", color: "var(--color-text-subtle)", margin: 0, lineHeight: "1.45" }}>
                            {a.description_text.slice(0, 100)}{a.description_text.length > 100 ? "..." : ""}
                          </p>
                        )}
                      </div>
                      {sub && (
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/submissions/${sub.id}`); }}
                          style={{
                            height: "36px", padding: "0 18px", borderRadius: "8px", flexShrink: 0,
                            backgroundColor: "var(--color-btn-primary-bg)", color: "var(--color-btn-primary-color)",
                            border: "none", fontSize: "13px", fontWeight: 600, cursor: "pointer",
                          }}
                        >
                          {isInProgress ? "Продолжить" : isPassed ? "Просмотреть" : "Подробнее"}
                        </button>
                      )}
                    </div>

                    {/* All attempts history */}
                    {allSubs.length > 0 && (
                      <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--color-border)" }}>
                        <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-subtle)", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                          История попыток ({allSubs.length})
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          {allSubs.map((s, idx) => {
                            const attemptPassed = s.pass_fail === "pass";
                            const attemptFailed = s.status === "done" && s.pass_fail === "fail";
                            const attemptPending = s.status !== "done";
                            const attemptScore = s.score != null ? Math.round(s.score * 100) : null;
                            return (
                              <div
                                key={s.id}
                                onClick={() => router.push(`/dashboard/submissions/${s.id}`)}
                                style={{
                                  display: "flex", alignItems: "center", gap: "10px",
                                  padding: "6px 10px", borderRadius: "7px", cursor: "pointer",
                                  backgroundColor: idx === 0 ? "var(--color-card-subtle)" : "transparent",
                                  transition: "background 0.15s",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-card-subtle)")}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = idx === 0 ? "var(--color-card-subtle)" : "transparent")}
                              >
                                <span style={{ fontSize: "12px", color: "var(--color-text-subtle)", flexShrink: 0, minWidth: "70px" }}>
                                  Попытка {allSubs.length - idx}
                                </span>
                                <span style={{
                                  fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "10px", flexShrink: 0,
                                  backgroundColor: attemptPassed ? "#dcfce7" : attemptFailed ? "#fee2e2" : "#eef2ff",
                                  color: attemptPassed ? "#15803d" : attemptFailed ? "#b91c1c" : "#3730a3",
                                }}>
                                  {attemptPending ? "⏳ Проверяется" : attemptPassed ? "✅ Сдано" : "❌ Не сдано"}
                                </span>
                                {attemptScore != null && (
                                  <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                                    {attemptScore}%
                                  </span>
                                )}
                                <span style={{ fontSize: "12px", color: "var(--color-text-subtle)", marginLeft: "auto" }}>
                                  {new Date(s.created_at).toLocaleDateString("ru-RU")}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Progress panel */}
        <div style={{
          width: "300px", flexShrink: 0,
          backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
          borderRadius: "14px", padding: "24px",
        }}>
          <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 24px", color: "var(--color-text-primary)" }}>
            Общий прогресс
          </h3>

          {/* Donut chart */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
            <div style={{ position: "relative", width: "120px", height: "120px" }}>
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="48" fill="none" stroke="var(--color-border)" strokeWidth="11" />
                <circle
                  cx="60" cy="60" r="48" fill="none"
                  stroke="var(--color-progress-active)" strokeWidth="11"
                  strokeDasharray={`${2 * Math.PI * 48 * (progress / 100)} ${2 * Math.PI * 48}`}
                  strokeDashoffset={2 * Math.PI * 48 * 0.25}
                  strokeLinecap="round"
                />
              </svg>
              <div style={{
                position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%, -50%)", textAlign: "center",
              }}>
                <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-text-primary)", lineHeight: 1 }}>
                  {progress}%
                </div>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "2px" }}>Курса</div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
            <div style={{
              backgroundColor: "var(--color-card-subtle)", borderRadius: "10px",
              padding: "14px 12px", textAlign: "center",
            }}>
              <div style={{ fontSize: "26px", fontWeight: 700, color: "var(--color-accent)" }}>{passedCount}</div>
              <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "2px", lineHeight: "1.3" }}>Решено задач</div>
            </div>
            <div style={{
              backgroundColor: "var(--color-card-subtle)", borderRadius: "10px",
              padding: "14px 12px", textAlign: "center",
            }}>
              <div style={{ fontSize: "26px", fontWeight: 700, color: "var(--color-accent)" }}>{inProgressCount}</div>
              <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "2px", lineHeight: "1.3" }}>В работе</div>
            </div>
          </div>

          <Link href="/dashboard/chat" style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            backgroundColor: "var(--color-btn-primary-bg)", color: "var(--color-btn-primary-color)",
            textDecoration: "none", borderRadius: "10px", height: "40px", fontSize: "14px", fontWeight: 600,
          }}>
            💬 Написать преподавателю
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Teacher Dashboard ──────────────────────────────────────────────────────────

function TeacherHome() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const teacherName = typeof window !== "undefined" ? sessionStorage.getItem("user_name") || "Преподаватель" : "Преподаватель";

  useEffect(() => {
    getStudents()
      .then((r) => (r.ok ? r.json() : []))
      .then((data: StudentRow[]) => { if (Array.isArray(data)) setStudents(data); })
      .finally(() => setLoading(false));
  }, []);

  const total = students.length;
  const problemCount = students.filter((s) => (s.progress ?? 0) < 50 && (s.total_tasks ?? 0) > 0).length;
  const stuckCount = students.filter((s) => (s.progress ?? 0) < 30).length;
  const avgPerf = students.length > 0
    ? Math.round(students.reduce((sum, s) => sum + (s.avg_score ?? 0), 0) / students.length)
    : 0;

  const statCards = [
    {
      label: "ВСЕГО СТУДЕНТОВ", value: String(total),
      iconBg: "#efedf4", icon: "👥",
    },
    {
      label: "АКТИВНЫЕ ПРОБЛЕМЫ", value: String(problemCount),
      iconBg: "#ffe4e6", icon: "⚠️",
    },
    {
      label: "В СТОПОРЕ", value: String(stuckCount),
      iconBg: "#ffedd5", icon: "⏱️",
    },
    {
      label: "СРЕДНЯЯ УСПЕВАЕМОСТЬ", value: `${avgPerf}%`,
      iconBg: "#dbeafe", icon: "📊",
    },
  ];

  const needsAttention = students
    .filter((s) => (s.progress ?? 0) < 50)
    .slice(0, 5);

  const filteredAttention = search
    ? needsAttention.filter((s) =>
        displayName(s).toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase())
      )
    : needsAttention;

  if (loading) {
    return (
      <div style={{ padding: "60px 45px", textAlign: "center", color: "var(--color-text-subtle)", fontSize: "18px" }}>
        Загрузка...
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "var(--color-bg-alt)", minHeight: "100%" }}>
      {/* Top bar */}
      <div style={{
        height: "64px", backgroundColor: "var(--color-card)",
        borderBottom: "1px solid var(--color-border)",
        display: "flex", alignItems: "center", padding: "0 40px", gap: "16px",
      }}>
        <div style={{
          flex: 1, maxWidth: "480px", backgroundColor: "var(--color-card-input)",
          borderRadius: "8px", height: "40px",
          display: "flex", alignItems: "center", gap: "10px", padding: "0 14px",
        }}>
          <span style={{ fontSize: "16px", color: "var(--color-text-muted)" }}>🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск студентов и заданий"
            style={{ border: "none", outline: "none", background: "transparent", fontSize: "14px", color: "var(--color-text-muted)", flex: 1 }}
          />
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "12px", alignItems: "center" }}>
          <span style={{ fontSize: "20px", cursor: "pointer", color: "var(--color-text-muted)" }}>🔔</span>
          <span style={{ fontSize: "20px", cursor: "pointer", color: "var(--color-text-muted)" }}>❓</span>
        </div>
      </div>

      <div style={{ padding: "36px 40px 40px" }}>
        {/* Greeting */}
        <h1 style={{ fontSize: "36px", fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 8px" }}>
          Добро пожаловать, {teacherName}
        </h1>
        <p style={{ fontSize: "16px", color: "var(--color-text-muted)", margin: "0 0 28px" }}>
          Вот краткий обзор текущей активности ваших студентов.
        </p>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "28px" }}>
          {statCards.map((s, i) => (
            <div key={i} style={{
              backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
              borderRadius: "14px", padding: "20px 18px",
              display: "flex", flexDirection: "column", gap: "0",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
                <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", margin: 0, maxWidth: "100px", lineHeight: "1.3" }}>
                  {s.label}
                </p>
                <div style={{
                  width: "40px", height: "40px", borderRadius: "8px",
                  backgroundColor: s.iconBg,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "20px",
                }}>
                  {s.icon}
                </div>
              </div>
              <p style={{ fontSize: "38px", fontWeight: 700, color: "var(--color-text-primary)", margin: 0, lineHeight: 1 }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Main content */}
        <div style={{ display: "flex", gap: "20px" }}>
          {/* Needs attention */}
          <div style={{
            flex: 1, backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
            borderRadius: "14px", overflow: "hidden",
          }}>
            <div style={{
              padding: "16px 24px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              borderBottom: "1px solid var(--color-border-card)",
            }}>
              <p style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "var(--color-text-primary)" }}>
                Требуют внимания
              </p>
              <Link href="/dashboard/students" style={{ fontSize: "14px", color: "var(--color-accent)", textDecoration: "none", fontWeight: 600 }}>
                Смотреть всех
              </Link>
            </div>

            {filteredAttention.length === 0 ? (
              <div style={{ padding: "32px 24px", textAlign: "center", color: "var(--color-text-subtle)", fontSize: "15px" }}>
                {students.length === 0
                  ? "Студентов ещё нет в системе."
                  : "Все студенты справляются!"}
              </div>
            ) : filteredAttention.map((s, i) => {
              const palette = AVATAR_PALETTE[i % AVATAR_PALETTE.length];
              const initials = getInitials(displayName(s));
              const progress = s.progress ?? 0;
              const isStuck = progress < 30;

              return (
                <div key={s.id} style={{
                  padding: "16px 24px",
                  borderBottom: i < filteredAttention.length - 1 ? "1px solid var(--color-border-card)" : "none",
                  display: "flex", alignItems: "center", gap: "14px",
                }}>
                  <div style={{
                    width: "44px", height: "44px", borderRadius: "50%",
                    backgroundColor: palette.bg,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <span style={{ fontSize: "15px", fontWeight: 700, color: palette.color }}>{initials}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "15px", fontWeight: 600, margin: "0 0 4px", color: "var(--color-text-primary)" }}>
                      {displayName(s)}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{
                        fontSize: "12px", fontWeight: 600, padding: "2px 10px", borderRadius: "12px",
                        backgroundColor: isStuck ? "#fee2e2" : "#fff3e0",
                        color: isStuck ? "#b91c1c" : "#c2410c",
                      }}>
                        {isStuck ? "В стопоре" : "Нужна помощь"}
                      </span>
                      <span style={{ fontSize: "12px", color: "var(--color-text-subtle)" }}>
                        🕐 Прогресс: {progress}%
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/chat?partner=${s.id}`}
                    style={{
                      height: "34px", padding: "0 16px", borderRadius: "8px",
                      backgroundColor: "var(--color-btn-primary-bg)", color: "var(--color-btn-primary-color)",
                      textDecoration: "none", fontSize: "13px", fontWeight: 600, flexShrink: 0,
                      display: "inline-flex", alignItems: "center",
                    }}
                  >
                    Написать
                  </Link>
                </div>
              );
            })}
          </div>

          {/* AI Insights */}
          <div style={{
            width: "310px", flexShrink: 0,
            backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
            borderRadius: "14px", padding: "22px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <span style={{ fontSize: "20px", color: "var(--color-accent)" }}>✦</span>
              <p style={{ fontSize: "18px", fontWeight: 700, color: "var(--color-accent)", margin: 0 }}>
                AI-Инсайты
              </p>
            </div>
            <p style={{ fontSize: "15px", lineHeight: "1.65", margin: 0, color: "var(--color-text-primary)" }}>
              {problemCount > 0 ? (
                <>
                  Система заметила, что{" "}
                  <span style={{ fontWeight: 700, color: "var(--color-accent)" }}>
                    {Math.round((problemCount / total) * 100)}% группы
                  </span>{" "}
                  испытывают сложности. Рекомендуется провести дополнительный разбор этой темы.
                </>
              ) : total > 0 ? (
                "Все студенты в порядке! Серьёзных проблем не обнаружено."
              ) : (
                "Студенты ещё не добавлены в систему."
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function DashboardHome() {
  const [role, setRole] = useState<"student" | "teacher">("student");

  useEffect(() => {
    const saved = sessionStorage.getItem("user_role") as "student" | "teacher" | null;
    if (saved) setRole(saved);
  }, []);

  return role === "teacher" ? <TeacherHome /> : <StudentHome />;
}
