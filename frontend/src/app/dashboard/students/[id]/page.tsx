"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getStudentDetails } from "@/lib/api";

interface TaskRow {
  lab_id: string;
  task_id: string;
  title: string;
  attempts: number;
  max_attempts: number;
  remaining: number;
  score: string;
  status: string;
  last_attempt: string;
}

interface CheckDetail {
  id: string;
  status: "PASS" | "FAIL" | "ERROR";
  description?: string;
  details?: string;
}

interface ResultRow {
  lab_id: string;
  task_id: string;
  title: string;
  score: string;
  passed: number;
  failed: number;
  total: number;
  timestamp: string;
  status: string;
  checks: CheckDetail[];
}

interface StudentData {
  student: {
    tg_id: number;
    email: string;
    github_alias: string;
    tg_username: string;
    server_ip?: string;
    student_group?: string;
    vm_username?: string;
  };
  tasks: TaskRow[];
  results: ResultRow[];
}

type StudentStatus = "active" | "stuck" | "needs_help";

function deriveStatus(tasks: TaskRow[]): StudentStatus {
  if (!tasks.length) return "needs_help";
  const passed = tasks.filter((t) => t.status === "pass" || t.status === "partial").length;
  const pct = (passed / tasks.length) * 100;
  if (pct >= 70) return "active";
  if (pct >= 30) return "needs_help";
  return "stuck";
}

const STATUS_LABELS: Record<StudentStatus, { label: string; bg: string; border: string; color: string }> = {
  active:     { label: "Активен",       bg: "#ecfdf5", border: "#b5f5d7", color: "#0e3e12" },
  stuck:      { label: "В стопоре",     bg: "#fef2f2", border: "#fec7c7", color: "#8f0000" },
  needs_help: { label: "Нужна помощь",  bg: "#fffbeb", border: "#fde372", color: "#af3f00" },
};

function taskStatusColor(status: string) {
  if (status === "pass")    return { bg: "#ecfdf5", color: "#0e3e12", label: "Сдано" };
  if (status === "partial") return { bg: "#fffbeb", color: "#af3f00", label: "Частично" };
  if (status === "fail")    return { bg: "#fef2f2", color: "#8f0000", label: "Не сдано" };
  return { bg: "#f1f1f1", color: "#555", label: "—" };
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [data, setData] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);

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

  const { student, tasks, results } = data;
  const status = deriveStatus(tasks);
  const statusInfo = STATUS_LABELS[status];
  const passed = tasks.filter((t) => t.status === "pass" || t.status === "partial").length;
  const progress = tasks.length ? Math.round((passed / tasks.length) * 100) : 0;
  const progressColor = status === "active" ? "var(--color-progress-active)" : status === "stuck" ? "#ba1a1a" : "#f59e0b";
  const initials = (student.github_alias || student.email).slice(0, 2).toUpperCase();

  // Group tasks by lab
  const labGroups: Record<string, TaskRow[]> = {};
  for (const t of tasks) {
    if (!labGroups[t.lab_id]) labGroups[t.lab_id] = [];
    labGroups[t.lab_id].push(t);
  }

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
                  {student.github_alias}
                </h1>
                <p style={{ fontSize: "15px", color: "var(--color-text-subtle)", margin: "0 0 12px" }}>
                  {student.tg_username && `${student.tg_username}  ·  `}{student.email}
                  {student.student_group && `  ·  Группа: ${student.student_group}`}
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
                { label: "Выполнено", value: `${passed} / ${tasks.length}` },
                { label: "Прогресс", value: `${progress}%`, bar: true },
                { label: "Последняя сдача", value: tasks.find((t) => t.last_attempt)?.last_attempt || "—" },
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

            {/* Tasks grouped by lab */}
            {Object.entries(labGroups).map(([labId, labTasks]) => (
              <div key={labId} style={{
                backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
                borderRadius: "14px", overflow: "hidden",
              }}>
                <div style={{
                  padding: "14px 24px", borderBottom: "1px solid var(--color-border-card)",
                  backgroundColor: "var(--color-bg-alt)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--color-text-primary)", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {labId.replace("lab-", "Лаб ")}
                  </h2>
                  <span style={{ fontSize: "13px", color: "var(--color-text-subtle)" }}>
                    {labTasks.filter((t) => t.status === "pass" || t.status === "partial").length} / {labTasks.length} выполнено
                  </span>
                </div>

                {/* Table header */}
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 110px 130px 130px 100px",
                  padding: "8px 24px", borderBottom: "1px solid var(--color-border-card)",
                  backgroundColor: "var(--color-card-alt)",
                }}>
                  {["Задание", "Баллы", "Попыток", "Осталось", "Статус"].map((h) => (
                    <span key={h} style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-subtle)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {h}
                    </span>
                  ))}
                </div>

                {labTasks.map((t, i) => {
                  const sc = taskStatusColor(t.status);
                  return (
                    <div
                      key={t.task_id}
                      style={{
                        display: "grid", gridTemplateColumns: "1fr 110px 130px 130px 100px",
                        padding: "14px 24px", alignItems: "center",
                        borderBottom: i < labTasks.length - 1 ? "1px solid var(--color-border-card)" : "none",
                      }}
                    >
                      <div>
                        <p style={{ margin: 0, fontSize: "15px", fontWeight: 500, color: "var(--color-text-primary)" }}>{t.title}</p>
                        {t.last_attempt && (
                          <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--color-text-subtle)" }}>
                            Последняя: {t.last_attempt}
                          </p>
                        )}
                      </div>
                      <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--color-accent)" }}>
                        {t.score !== "—" ? t.score.split("%")[0] + "%" : "—"}
                      </span>
                      <span style={{ fontSize: "14px", color: "var(--color-text-muted)" }}>
                        {t.attempts} / {t.max_attempts}
                      </span>
                      <span style={{ fontSize: "14px", color: t.remaining === 0 ? "#e53e3e" : "var(--color-text-muted)" }}>
                        {t.remaining}
                      </span>
                      <span style={{
                        display: "inline-flex", alignItems: "center",
                        backgroundColor: sc.bg, borderRadius: "10px", padding: "3px 10px",
                        fontSize: "12px", fontWeight: 600, color: sc.color, whiteSpace: "nowrap",
                      }}>
                        {sc.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Recent check history */}
            {results.length > 0 && (
              <div style={{
                backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
                borderRadius: "14px", overflow: "hidden",
              }}>
                <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--color-border-card)", backgroundColor: "var(--color-bg-alt)" }}>
                  <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--color-text-primary)", margin: 0 }}>
                    История проверок
                  </h2>
                </div>
                {results.slice(0, 10).map((r, i) => {
                  const key = `${r.lab_id}:${r.task_id}:${r.timestamp}`;
                  const isOpen = expandedResult === key;
                  const sc = taskStatusColor(r.status);
                  return (
                    <div key={key} style={{ borderBottom: i < Math.min(results.length, 10) - 1 ? "1px solid var(--color-border-card)" : "none" }}>
                      <div
                        onClick={() => setExpandedResult(isOpen ? null : key)}
                        style={{
                          padding: "14px 24px", cursor: "pointer",
                          display: "flex", alignItems: "center", gap: "16px",
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: "15px", fontWeight: 500, color: "var(--color-text-primary)" }}>
                            {r.title || `${r.lab_id} / ${r.task_id}`}
                          </p>
                          <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--color-text-subtle)" }}>
                            {(r.timestamp || "").slice(0, 16).replace("T", " ")}
                            {r.total ? `  ·  ${r.passed ?? 0}/${r.total} проверок` : ""}
                          </p>
                        </div>
                        <span style={{
                          backgroundColor: sc.bg, color: sc.color,
                          borderRadius: "10px", padding: "3px 12px",
                          fontSize: "13px", fontWeight: 600, flexShrink: 0,
                        }}>
                          {r.score || sc.label}
                        </span>
                        <span style={{ fontSize: "18px", color: "var(--color-text-subtle)", flexShrink: 0 }}>
                          {isOpen ? "▲" : "▼"}
                        </span>
                      </div>

                      {isOpen && r.checks && r.checks.length > 0 && (
                        <div style={{ padding: "0 24px 16px", backgroundColor: "var(--color-card-alt)" }}>
                          {r.checks.map((c, ci) => (
                            <div key={ci} style={{
                              display: "flex", gap: "12px", alignItems: "flex-start",
                              padding: "8px 0",
                              borderBottom: ci < r.checks.length - 1 ? "1px solid var(--color-border-card)" : "none",
                            }}>
                              <span style={{
                                fontSize: "13px", fontWeight: 700, flexShrink: 0, marginTop: "1px",
                                color: c.status === "PASS" ? "#0e3e12" : c.status === "FAIL" ? "#8f0000" : "#af3f00",
                              }}>
                                {c.status === "PASS" ? "✓" : c.status === "FAIL" ? "✗" : "!"}
                              </span>
                              <div>
                                <p style={{ margin: 0, fontSize: "13px", color: "var(--color-text-primary)" }}>
                                  {c.description || c.id}
                                </p>
                                {c.details && (
                                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--color-text-subtle)", fontFamily: "monospace" }}>
                                    {c.details}
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
            )}
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
                  href={`/dashboard/chat?student=${student.github_alias}`}
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
                <a
                  href={`http://localhost:8000/student/${student.github_alias}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    backgroundColor: "var(--color-card)", color: "var(--color-accent)",
                    border: "1.5px solid var(--color-accent)", borderRadius: "10px",
                    height: "44px", padding: "0 18px",
                    fontSize: "15px", fontWeight: 600, textDecoration: "none",
                  }}
                >
                  <span>🔗</span> Открыть в дашборде
                </a>
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
                {student.email && (
                  <p style={{ fontSize: "14px", color: "var(--color-text-muted)", margin: 0 }}>
                    <strong>Email:</strong> {student.email}
                  </p>
                )}
                {student.tg_username && (
                  <p style={{ fontSize: "14px", color: "var(--color-text-muted)", margin: 0 }}>
                    <strong>Telegram:</strong> {student.tg_username}
                  </p>
                )}
                {student.github_alias && (
                  <p style={{ fontSize: "14px", color: "var(--color-text-muted)", margin: 0 }}>
                    <strong>GitHub:</strong> {student.github_alias}
                  </p>
                )}
                {student.server_ip && (
                  <p style={{ fontSize: "14px", color: "var(--color-text-muted)", margin: 0 }}>
                    <strong>Server IP:</strong> {student.server_ip}
                  </p>
                )}
                {student.student_group && (
                  <p style={{ fontSize: "14px", color: "var(--color-text-muted)", margin: 0 }}>
                    <strong>Группа:</strong> {student.student_group}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
