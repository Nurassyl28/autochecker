"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getStudentDetails } from "@/lib/api";

// v2 API shapes
interface StudentProfile {
  id: number;
  email: string;
  full_name: string | null;
  tg_id: number | null;
  role: string;
  created_at: string;
}

interface CheckResult {
  id: string;
  passed: boolean;
  feedback?: string;
  weight?: number;
}

interface FeedbackJson {
  summary?: string;
  overall_passed?: boolean;
  check_results?: CheckResult[];
}

interface Submission {
  id: number;
  assignment_id: number;
  assignment_title?: string;
  repo_url: string;
  status: "pending" | "processing" | "done" | "error";
  pass_fail: "pass" | "fail" | null;
  score: number | null;
  feedback_json: FeedbackJson | null;
  created_at: string;
  completed_at: string | null;
}

interface Stats {
  total: number;
  done: number;
  passed: number;
  failed: number;
}

interface ProfileData {
  student: StudentProfile;
  submissions: Submission[];
  llm_summary: string | null;
  stats: Stats;
}

type StudentStatus = "active" | "stuck" | "needs_help";

function deriveStatus(stats: Stats): StudentStatus {
  if (!stats.total) return "needs_help";
  const pct = stats.total > 0 ? (stats.passed / stats.total) * 100 : 0;
  if (pct >= 70) return "active";
  if (pct >= 30) return "needs_help";
  return "stuck";
}

const STATUS_LABELS: Record<StudentStatus, { label: string; bg: string; border: string; color: string }> = {
  active:     { label: "Активен",       bg: "#ecfdf5", border: "#b5f5d7", color: "#0e3e12" },
  stuck:      { label: "В стопоре",     bg: "#fef2f2", border: "#fec7c7", color: "#8f0000" },
  needs_help: { label: "Нужна помощь",  bg: "#fffbeb", border: "#fde372", color: "#af3f00" },
};

function submissionStatusColor(s: Submission) {
  if (s.status !== "done") return { bg: "#eef2ff", color: "#3332ce", label: "В процессе" };
  if (s.pass_fail === "pass")  return { bg: "#ecfdf5", color: "#0e3e12", label: "Сдано" };
  if (s.pass_fail === "fail")  return { bg: "#fef2f2", color: "#8f0000", label: "Не сдано" };
  return { bg: "#f1f1f1", color: "#555", label: "—" };
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    getStudentDetails(id)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setData(d); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ padding: "60px 45px", textAlign: "center", color: "var(--color-text-subtle)", fontSize: "18px" }}>
        Загрузка...
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: "60px 45px", textAlign: "center", color: "var(--color-text-subtle)", fontSize: "18px" }}>
        Студент не найден.
      </div>
    );
  }

  const { student, submissions, llm_summary, stats } = data;
  const status = deriveStatus(stats);
  const statusInfo = STATUS_LABELS[status];
  const progress = stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;
  const progressColor = status === "active" ? "var(--color-progress-active)" : status === "stuck" ? "#ba1a1a" : "#f59e0b";
  const displayName = student.full_name || student.email.split("@")[0];
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div style={{ backgroundColor: "var(--color-bg-alt)", minHeight: "100%" }}>
      {/* Top bar */}
      <div style={{
        height: "70px", backgroundColor: "var(--color-topbar)",
        borderBottom: "1px solid var(--color-border)",
        display: "flex", alignItems: "center", padding: "0 45px", gap: "14px",
      }}>
        <button
          onClick={() => router.back()}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "22px", color: "var(--color-text-muted)", padding: 0 }}
        >←</button>
        <span style={{ fontSize: "20px", fontWeight: 600, color: "var(--color-text-primary)" }}>
          Профиль студента
        </span>
      </div>

      <div style={{ padding: "36px 45px" }}>
        <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>

          {/* Left — main info */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "20px" }}>

            {/* Student card */}
            <div style={{
              backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
              borderRadius: "14px", padding: "28px 30px",
              display: "flex", alignItems: "center", gap: "24px",
            }}>
              <div style={{
                width: "76px", height: "76px", borderRadius: "50%",
                backgroundColor: "#e8e4f0", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: "30px", fontWeight: 700, color: "var(--color-accent)" }}>{initials}</span>
              </div>

              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: "26px", fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 6px" }}>
                  {displayName}
                </h1>
                <p style={{ fontSize: "15px", color: "var(--color-text-subtle)", margin: "0 0 12px" }}>
                  {student.tg_id && `TG: ${student.tg_id}  ·  `}{student.email}
                </p>
                <span style={{
                  backgroundColor: statusInfo.bg, border: `1px solid ${statusInfo.border}`,
                  borderRadius: "14px", padding: "5px 16px",
                  fontSize: "13px", fontWeight: 600, color: statusInfo.color,
                }}>
                  {statusInfo.label}
                </span>
              </div>
            </div>

            {/* Score stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
              {[
                { label: "Выполнено", value: `${stats.passed} / ${stats.total}` },
                { label: "Прогресс",  value: `${progress}%`, bar: true },
                { label: "Сдано / Не сдано", value: `${stats.passed} / ${stats.failed}` },
              ].map((card) => (
                <div key={card.label} style={{
                  backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
                  borderRadius: "12px", padding: "20px 22px",
                }}>
                  <p style={{ fontSize: "13px", color: "var(--color-text-subtle)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.5px", margin: "0 0 10px" }}>
                    {card.label}
                  </p>
                  <p style={{ fontSize: "30px", fontWeight: 700, color: "var(--color-accent)", margin: "0 0 8px", lineHeight: 1 }}>
                    {card.value}
                  </p>
                  {card.bar && (
                    <div style={{ width: "100%", height: "6px", backgroundColor: "var(--color-border)", borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${progress}%`, backgroundColor: progressColor, borderRadius: "3px" }} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* AI Summary */}
            {llm_summary && (
              <div style={{
                backgroundColor: "var(--color-card-alt)", border: "1px solid var(--color-border-card)",
                borderRadius: "14px", padding: "22px 26px",
              }}>
                <p style={{ fontSize: "15px", fontWeight: 600, color: "#0f1d74", margin: "0 0 10px" }}>
                  🤖 AI-сводка по студенту
                </p>
                <p style={{ fontSize: "15px", lineHeight: "1.6", color: "var(--color-text-primary)", margin: 0 }}>
                  {llm_summary}
                </p>
              </div>
            )}

            {/* Submissions list */}
            <div style={{
              backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
              borderRadius: "14px", overflow: "hidden",
            }}>
              <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--color-border-card)", backgroundColor: "var(--color-bg-alt)" }}>
                <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--color-text-primary)", margin: 0 }}>
                  Сданные работы ({submissions.length})
                </h2>
              </div>

              {submissions.length === 0 && (
                <div style={{ padding: "32px 24px", textAlign: "center", color: "var(--color-text-subtle)", fontSize: "15px" }}>
                  Работы ещё не сданы.
                </div>
              )}

              {submissions.map((sub, i) => {
                const sc = submissionStatusColor(sub);
                const isOpen = expandedId === sub.id;
                const scoreStr = sub.score != null ? `${Math.round(sub.score * 100)}%` : null;
                const checks = sub.feedback_json?.check_results ?? [];

                return (
                  <div key={sub.id} style={{ borderBottom: i < submissions.length - 1 ? "1px solid var(--color-border-card)" : "none" }}>
                    <div
                      onClick={() => setExpandedId(isOpen ? null : sub.id)}
                      style={{ padding: "14px 24px", cursor: "pointer", display: "flex", alignItems: "center", gap: "16px" }}
                    >
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: "15px", fontWeight: 500, color: "var(--color-text-primary)" }}>
                          {sub.assignment_title || `Задание #${sub.assignment_id}`}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--color-text-subtle)" }}>
                          {sub.created_at.slice(0, 16).replace("T", " ")}
                          {sub.repo_url && (
                            <> · <a href={sub.repo_url} target="_blank" rel="noreferrer" style={{ color: "var(--color-accent)" }} onClick={(e) => e.stopPropagation()}>репозиторий</a></>
                          )}
                        </p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                        {scoreStr && (
                          <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--color-accent)" }}>
                            {scoreStr}
                          </span>
                        )}
                        <span style={{
                          backgroundColor: sc.bg, color: sc.color,
                          borderRadius: "10px", padding: "3px 12px",
                          fontSize: "13px", fontWeight: 600,
                        }}>
                          {sc.label}
                        </span>
                        {checks.length > 0 && (
                          <span style={{ fontSize: "18px", color: "var(--color-text-subtle)" }}>
                            {isOpen ? "▲" : "▼"}
                          </span>
                        )}
                      </div>
                    </div>

                    {isOpen && checks.length > 0 && (
                      <div style={{ padding: "0 24px 16px", backgroundColor: "var(--color-card-alt)" }}>
                        {sub.feedback_json?.summary && (
                          <p style={{ fontSize: "14px", color: "var(--color-text-muted)", marginBottom: "10px", fontStyle: "italic" }}>
                            {sub.feedback_json.summary}
                          </p>
                        )}
                        {checks.map((c, ci) => (
                          <div key={ci} style={{
                            display: "flex", gap: "12px", alignItems: "flex-start",
                            padding: "8px 0",
                            borderBottom: ci < checks.length - 1 ? "1px solid var(--color-border-card)" : "none",
                          }}>
                            <span style={{
                              fontSize: "13px", fontWeight: 700, flexShrink: 0, marginTop: "1px",
                              color: c.passed ? "#0e3e12" : "#8f0000",
                            }}>
                              {c.passed ? "✓" : "✗"}
                            </span>
                            <div>
                              <p style={{ margin: 0, fontSize: "13px", color: "var(--color-text-primary)" }}>
                                {c.id}
                              </p>
                              {c.feedback && (
                                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--color-text-subtle)" }}>
                                  {c.feedback}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right — quick actions */}
          <div style={{ width: "280px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{
              backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
              borderRadius: "14px", padding: "22px 20px",
            }}>
              <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 16px" }}>
                Действия
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <Link
                  href={`/dashboard/chat?partner=${student.id}`}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    backgroundColor: "var(--color-btn-primary-bg)", color: "var(--color-btn-primary-color)",
                    textDecoration: "none", borderRadius: "10px",
                    height: "44px", padding: "0 18px",
                    fontSize: "15px", fontWeight: 600,
                  }}
                >
                  <span>💬</span> Написать в чат
                </Link>
              </div>
            </div>

            <div style={{
              backgroundColor: "var(--color-card-alt)", border: "1px solid var(--color-border-card)",
              borderRadius: "14px", padding: "20px",
            }}>
              <h3 style={{ fontSize: "15px", fontWeight: 600, color: "#0f1d74", margin: "0 0 12px" }}>
                Контакты
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <p style={{ fontSize: "14px", color: "var(--color-text-muted)", margin: 0 }}>
                  <strong>Email:</strong> {student.email}
                </p>
                {student.tg_id && (
                  <p style={{ fontSize: "14px", color: "var(--color-text-muted)", margin: 0 }}>
                    <strong>Telegram ID:</strong> {student.tg_id}
                  </p>
                )}
                <p style={{ fontSize: "14px", color: "var(--color-text-muted)", margin: 0 }}>
                  <strong>ID:</strong> {student.id}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
