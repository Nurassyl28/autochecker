"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getStudents, getMyData } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

// v2 teacher student row
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

// v2 assignment (for student view)
interface Assignment {
  id: number;
  title: string;
  description_text: string | null;
  spec_status: string;
  created_at: string;
}

// v2 submission (for student view)
interface Submission {
  id: number;
  assignment_id: number;
  status: string;
  pass_fail: "pass" | "fail" | null;
  score: number | null;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function displayName(s: StudentRow) {
  return s.full_name || s.email.split("@")[0];
}

function studentBadge(s: StudentRow) {
  const p = s.progress ?? 0;
  if (p >= 70) return { label: "Активен", bg: "#ecfdf5", border: "#b5f5d7", color: "#0e3e12" };
  if (p >= 30) return { label: "Нужна помощь", bg: "#fffbeb", border: "#fde372", color: "#af3f00" };
  return { label: "В стопоре", bg: "#fef2f2", border: "#fec7c7", color: "#8f0000" };
}

function submissionStatusLabel(status: string, pass_fail: string | null) {
  if (status === "done" && pass_fail === "pass") return { label: "Выполнено", bg: "#ecfdf5", color: "#0e3e12" };
  if (status === "done" && pass_fail === "fail") return { label: "Не сдано",  bg: "#fef2f2", color: "#8f0000" };
  if (status === "processing" || status === "pending") return { label: "В процессе", bg: "#eef2ff", color: "#3332ce" };
  if (status === "error") return { label: "Ошибка", bg: "#fff3e0", color: "#e65100" };
  return { label: "—", bg: "#f1f1f1", color: "#555" };
}

// ── Student Dashboard ──────────────────────────────────────────────────────────

function StudentHome() {
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

  const name = sessionStorage.getItem("user_name") || "Студент";

  // Map assignment → latest submission for status
  const latestSub = (assignmentId: number): Submission | undefined =>
    submissions
      .filter((s) => s.assignment_id === assignmentId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  const passedCount = assignments.filter((a) => {
    const sub = latestSub(a.id);
    return sub?.pass_fail === "pass";
  }).length;

  const progress = assignments.length > 0 ? Math.round((passedCount / assignments.length) * 100) : 0;

  const doneScores = submissions
    .filter((s) => s.status === "done" && s.score != null)
    .map((s) => s.score as number);
  const avgScore = doneScores.length
    ? Math.round((doneScores.reduce((a, b) => a + b, 0) / doneScores.length) * 100)
    : 0;

  if (loading) {
    return (
      <div style={{ padding: "60px 45px", textAlign: "center", color: "var(--color-text-subtle)", fontSize: "18px" }}>
        Загрузка...
      </div>
    );
  }

  return (
    <div style={{ padding: "43px 45px 40px 45px", backgroundColor: "var(--color-bg)", minHeight: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "32px" }}>
        <div>
          <h1 style={{ fontSize: "40px", fontWeight: 700, color: "var(--color-text-primary)", margin: 0, lineHeight: "1.2" }}>
            С возвращением, {name}!
          </h1>
          <p style={{ fontSize: "18px", color: "var(--color-text-muted)", margin: "10px 0 0" }}>
            {assignments.length > 0
              ? `У вас ${assignments.length} заданий.`
              : "Задания не назначены."}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Image src="/assets/icons/star-icon.png" alt="" width={39} height={39} className="object-contain" />
          <span style={{ fontSize: "31px", fontWeight: 600, color: "var(--color-text-primary)" }}>
            {passedCount * 100}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: "24px" }}>
        {/* Assignments list */}
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: "22px", fontWeight: 600, marginBottom: "16px", color: "var(--color-text-primary)" }}>
            Ваши задания
          </h2>

          {assignments.length === 0 ? (
            <div style={{
              backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
              borderRadius: "8px", padding: "32px 24px", textAlign: "center", color: "var(--color-text-subtle)",
            }}>
              <p style={{ fontSize: "18px", margin: 0 }}>Задания не найдены. Данные появятся после добавления администратором.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {assignments.map((a) => {
                const sub = latestSub(a.id);
                const badge = submissionStatusLabel(sub?.status ?? "none", sub?.pass_fail ?? null);
                const score = sub?.score != null ? `${Math.round(sub.score * 100)}%` : null;
                return (
                  <div key={a.id} style={{
                    backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
                    borderRadius: "8px", padding: "14px 20px",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px",
                  }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: "16px", fontWeight: 500, color: "var(--color-text-primary)", margin: "0 0 4px" }}>
                        {a.title}
                      </p>
                      <span style={{ fontSize: "13px", color: "var(--color-text-subtle)" }}>
                        {a.created_at.slice(0, 10)}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
                      {score && (
                        <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--color-accent)" }}>{score}</span>
                      )}
                      <span style={{
                        backgroundColor: badge.bg, color: badge.color,
                        borderRadius: "14px", padding: "3px 12px",
                        fontSize: "13px", fontWeight: 500,
                      }}>
                        {badge.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Progress sidebar */}
        <div style={{
          width: "337px", flexShrink: 0,
          backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
          borderRadius: "15px", padding: "24px 24px 20px",
        }}>
          <h3 style={{ fontSize: "22px", fontWeight: 600, margin: "0 0 24px", color: "var(--color-text-primary)" }}>
            Мои результаты
          </h3>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
            <div style={{ position: "relative", width: "129px", height: "126px" }}>
              <svg width="129" height="126" viewBox="0 0 129 126">
                <circle cx="64" cy="63" r="54" fill="none" stroke="var(--color-border)" strokeWidth="12" />
                <circle cx="64" cy="63" r="54" fill="none" stroke="var(--color-progress-active)" strokeWidth="12"
                  strokeDasharray={`${2 * Math.PI * 54 * (progress / 100)} ${2 * Math.PI * 54}`}
                  strokeDashoffset={2 * Math.PI * 54 * 0.25} strokeLinecap="round" />
              </svg>
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
                <div style={{ fontSize: "26px", fontWeight: 500, color: "var(--color-text-primary)" }}>
                  {progress > 0 ? `${progress}%` : "—"}
                </div>
                <div style={{ fontSize: "14px", color: "var(--color-text-muted)" }}>Прогресс</div>
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div style={{ backgroundColor: "var(--color-card-subtle)", borderRadius: "7px", padding: "14px 16px", textAlign: "center" }}>
              <div style={{ fontSize: "27px", fontWeight: 600, color: "var(--color-accent)" }}>
                {avgScore > 0 ? `${avgScore}%` : "—"}
              </div>
              <div style={{ fontSize: "14px", color: "var(--color-text-muted)", marginTop: "4px" }}>Средний балл</div>
            </div>
            <div style={{ backgroundColor: "var(--color-card-subtle)", borderRadius: "7px", padding: "14px 16px", textAlign: "center" }}>
              <div style={{ fontSize: "27px", fontWeight: 600, color: "var(--color-accent)" }}>
                {passedCount} / {assignments.length}
              </div>
              <div style={{ fontSize: "14px", color: "var(--color-text-muted)", marginTop: "4px" }}>Выполнено</div>
            </div>
          </div>
          <div style={{ marginTop: "16px" }}>
            <Link href="/dashboard/chat" style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              backgroundColor: "var(--color-btn-primary-bg)", color: "var(--color-btn-primary-color)",
              textDecoration: "none", borderRadius: "10px", height: "42px", fontSize: "15px", fontWeight: 500,
            }}>
              💬 Написать преподавателю
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Teacher Dashboard ──────────────────────────────────────────────────────────

function TeacherHome() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [topSearch, setTopSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStudents()
      .then((r) => (r.ok ? r.json() : []))
      .then((data: StudentRow[]) => { if (Array.isArray(data)) setStudents(data); })
      .finally(() => setLoading(false));
  }, []);

  // Compute stats from students list
  const total = students.length;
  const activeCount = students.filter((s) => (s.progress ?? 0) >= 70).length;
  const stuckCount  = students.filter((s) => (s.progress ?? 0) < 30).length;
  const avgPerf = students.length > 0
    ? Math.round(students.reduce((sum, s) => sum + (s.avg_score ?? 0), 0) / students.length)
    : 0;

  const statCards = [
    { label: "Всего студентов",    value: String(total),     iconBg: "#efedf4", icon: "/assets/icons/people-icon.png" },
    { label: "Активные",          value: String(activeCount), iconBg: "#dfe0ff", icon: "/assets/icons/signal-icon.png" },
    { label: "В стопоре",         value: String(stuckCount),  iconBg: "#ffdbc7", icon: "/assets/icons/historical-icon.png" },
    { label: "Средняя успеваемость", value: `${avgPerf}%`,   iconBg: "#dfe0ff", icon: "/assets/icons/signal-icon.png" },
  ];

  // Students needing attention: low progress
  const attention = students.slice(0, 5);

  const filtered = topSearch
    ? attention.filter((s) =>
        displayName(s).toLowerCase().includes(topSearch.toLowerCase()) ||
        s.email.toLowerCase().includes(topSearch.toLowerCase())
      )
    : attention;

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
        height: "70px", backgroundColor: "var(--color-topbar)", borderBottom: "1px solid var(--color-border)",
        display: "flex", alignItems: "center", padding: "0 45px", gap: "16px",
      }}>
        <div style={{
          flex: 1, maxWidth: "504px", backgroundColor: "var(--color-card-input)",
          borderRadius: "8px", height: "43px", display: "flex", alignItems: "center", gap: "10px", padding: "0 14px",
        }}>
          <Image src="/assets/icons/search-icon.png" alt="" width={22} height={22} className="object-contain" />
          <input
            value={topSearch}
            onChange={(e) => setTopSearch(e.target.value)}
            placeholder="Поиск студентов..."
            style={{ border: "none", outline: "none", background: "transparent", fontSize: "16px", color: "var(--color-text-muted)", flex: 1 }}
          />
        </div>
        <div style={{ marginLeft: "auto" }}>
          <Image src="/assets/icons/doorbell-icon.png" alt="" width={26} height={26} className="object-contain" />
        </div>
      </div>

      <div style={{ padding: "43px 45px 0" }}>
        <h1 style={{ fontSize: "40px", fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 8px" }}>
          Добро пожаловать!
        </h1>
        <p style={{ fontSize: "18px", color: "var(--color-text-light)", margin: "0 0 32px" }}>
          Вот краткий обзор текущей активности ваших студентов.
        </p>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "18px", marginBottom: "28px" }}>
          {statCards.map((s) => (
            <div key={s.label} style={{
              backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
              borderRadius: "15px", padding: "24px 20px 20px", position: "relative",
            }}>
              <div style={{
                position: "absolute", top: "18px", right: "18px",
                backgroundColor: s.iconBg, borderRadius: "9px", width: "44px", height: "44px",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Image src={s.icon} alt="" width={22} height={22} className="object-contain" />
              </div>
              <p style={{ fontSize: "15px", fontWeight: 500, color: "var(--color-text-light)", textTransform: "uppercase", margin: "0 0 48px", maxWidth: "130px" }}>
                {s.label}
              </p>
              <p style={{ fontSize: "41px", fontWeight: 700, color: "var(--color-text-primary)", margin: 0, lineHeight: "1" }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Attention + AI */}
        <div style={{ display: "flex", gap: "22px", marginBottom: "40px" }}>
          <div style={{
            flex: 1, backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
            borderRadius: "13px", overflow: "hidden",
          }}>
            <div style={{
              backgroundColor: "var(--color-bg-alt)", borderBottom: "1px solid var(--color-border-card)",
              padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <p style={{ fontSize: "22.5px", fontWeight: 500, margin: 0, color: "var(--color-text-primary)" }}>
                Студенты
              </p>
              <Link href="/dashboard/students" style={{ fontSize: "16px", color: "var(--color-accent)", textDecoration: "none", fontWeight: 500 }}>
                Смотреть всех
              </Link>
            </div>

            {filtered.length === 0 ? (
              <div style={{ padding: "32px 24px", textAlign: "center", color: "var(--color-text-subtle)", fontSize: "16px" }}>
                {students.length === 0
                  ? "Студенты ещё не зарегистрированы."
                  : "Студенты не найдены."}
              </div>
            ) : filtered.map((s, i) => {
              const badge = studentBadge(s);
              const initials = displayName(s).slice(0, 2).toUpperCase();
              return (
                <div key={s.id} style={{
                  padding: "18px 24px",
                  borderBottom: i < filtered.length - 1 ? "1px solid var(--color-border-card)" : "none",
                  display: "flex", alignItems: "center", gap: "16px",
                }}>
                  <div style={{
                    width: "56px", height: "56px", borderRadius: "50%",
                    backgroundColor: "#f5e0c8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <span style={{ fontSize: "22px", fontWeight: 700, color: "#4a1f00" }}>{initials}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "18px", fontWeight: 500, margin: "0 0 4px", color: "var(--color-text-primary)" }}>
                      {displayName(s)}
                    </p>
                    <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: "5px",
                        backgroundColor: badge.bg, border: `1px solid ${badge.border}`,
                        borderRadius: "12.5px", padding: "3px 10px", fontSize: "13px", color: badge.color,
                      }}>
                        {badge.label}
                      </span>
                      <span style={{ fontSize: "13px", color: "var(--color-text-subtle)", alignSelf: "center" }}>
                        {s.email}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/students/${s.id}`}
                    style={{
                      backgroundColor: "var(--color-btn-primary-bg)", color: "var(--color-btn-primary-color)",
                      textDecoration: "none", borderRadius: "10px", height: "35px", padding: "0 18px",
                      fontSize: "16px", fontWeight: 500, flexShrink: 0, display: "inline-flex", alignItems: "center",
                    }}
                  >
                    Подробнее
                  </Link>
                </div>
              );
            })}
          </div>

          {/* AI Insights */}
          <div style={{
            width: "336px", flexShrink: 0,
            backgroundColor: "var(--color-card-alt)", border: "1px solid var(--color-border-card)",
            borderRadius: "13px", padding: "24px 22px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <Image src="/assets/icons/ai-icon.png" alt="" width={27} height={27} className="object-contain" />
              <p style={{ fontSize: "23px", fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
                AI-Инсайты
              </p>
            </div>
            <p style={{ fontSize: "18px", lineHeight: "33px", margin: 0, color: "var(--color-text-primary)" }}>
              {stuckCount > 0
                ? <>Система заметила, что <span style={{ fontWeight: 500, color: "var(--color-accent)" }}>{stuckCount} студентов</span> испытывают сложности. Рекомендуется провести дополнительный разбор.</>
                : total > 0
                  ? "Все студенты в порядке! Серьёзных проблем не обнаружено."
                  : "Студенты ещё не добавлены в систему."}
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
