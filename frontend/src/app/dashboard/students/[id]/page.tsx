"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  getAllTgStudents,
  getAddedStudents,
  getAssignments,
  getStudentScores,
  calcStudentStats,
  type TgStudent,
  type Assignment,
} from "@/lib/store";

type StudentStatus = "active" | "stuck" | "needs_help";

function getStatus(avg: number, total: number): StudentStatus {
  if (total === 0) return "needs_help";
  if (avg >= 4.0) return "active";
  if (avg >= 3.0) return "needs_help";
  return "stuck";
}

const STATUS_LABELS: Record<StudentStatus, { label: string; bg: string; border: string; color: string }> = {
  active: { label: "Активен", bg: "#ecfdf5", border: "#b5f5d7", color: "#0e3e12" },
  stuck: { label: "В стопоре", bg: "#fef2f2", border: "#fec7c7", color: "#8f0000" },
  needs_help: { label: "Нужна помощь", bg: "#fffbeb", border: "#fde372", color: "#af3f00" },
};

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [student, setStudent] = useState<TgStudent | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [stats, setStats] = useState({ avg: 0, total: 0 });

  useEffect(() => {
    const all = [...getAllTgStudents(), ...getAddedStudents()];
    const unique = all.filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i);
    const found = unique.find((s) => s.id === id) || null;
    setStudent(found);

    const assigns = getAssignments();
    setAssignments(assigns);
    setScores(getStudentScores(id));
    setStats(calcStudentStats(id));
  }, [id]);

  if (!student) {
    return (
      <div style={{ padding: "60px 45px", textAlign: "center", color: "var(--color-text-subtle)", fontSize: "18px" }}>
        Студент не найден.
      </div>
    );
  }

  const status = getStatus(stats.avg, stats.total);
  const statusInfo = STATUS_LABELS[status];
  const gradedCount = Object.keys(scores).length;
  const progress = assignments.length > 0 ? Math.round((gradedCount / assignments.length) * 100) : 0;
  const progressColor = status === "active" ? "var(--color-progress-active)" : status === "stuck" ? "#ba1a1a" : "#f59e0b";

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
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: "22px", color: "var(--color-text-muted)", padding: 0,
            display: "flex", alignItems: "center",
          }}
        >←</button>
        <span style={{ fontSize: "20px", fontWeight: 600, color: "var(--color-text-primary)" }}>Профиль студента</span>
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
                <span style={{ fontSize: "30px", fontWeight: 700, color: "var(--color-accent)" }}>{student.initial}</span>
              </div>

              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: "26px", fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 6px" }}>{student.name}</h1>
                <p style={{ fontSize: "15px", color: "var(--color-text-subtle)", margin: "0 0 12px" }}>
                  {student.tg_username}&nbsp;&nbsp;·&nbsp;&nbsp;{student.email}
                </p>
                <span style={{
                  backgroundColor: statusInfo.bg, border: `1px solid ${statusInfo.border}`,
                  borderRadius: "14px", padding: "5px 16px",
                  fontSize: "13px", fontWeight: 600, color: statusInfo.color,
                }}>
                  {statusInfo.label}
                </span>
              </div>

              <Link
                href={`/dashboard/chat?student=${student.id}`}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "8px",
                  backgroundColor: "var(--color-btn-primary-bg)", color: "var(--color-btn-primary-color)",
                  textDecoration: "none", borderRadius: "10px",
                  height: "44px", padding: "0 24px",
                  fontSize: "15px", fontWeight: 600, flexShrink: 0,
                }}
              >
                <span style={{ fontSize: "18px" }}>💬</span>
                Написать
              </Link>
            </div>

            {/* Score stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
              <div style={{
                backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
                borderRadius: "12px", padding: "20px 22px",
              }}>
                <p style={{ fontSize: "13px", color: "var(--color-text-subtle)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.5px", margin: "0 0 10px" }}>
                  Средний балл
                </p>
                <p style={{ fontSize: "36px", fontWeight: 700, color: "var(--color-accent)", margin: 0, lineHeight: 1 }}>
                  {stats.avg}
                </p>
              </div>
              <div style={{
                backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
                borderRadius: "12px", padding: "20px 22px",
              }}>
                <p style={{ fontSize: "13px", color: "var(--color-text-subtle)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.5px", margin: "0 0 10px" }}>
                  Общий балл
                </p>
                <p style={{ fontSize: "36px", fontWeight: 700, color: "var(--color-text-primary)", margin: 0, lineHeight: 1 }}>
                  {stats.total.toLocaleString("ru")}
                </p>
              </div>
              <div style={{
                backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
                borderRadius: "12px", padding: "20px 22px",
              }}>
                <p style={{ fontSize: "13px", color: "var(--color-text-subtle)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.5px", margin: "0 0 10px" }}>
                  Прогресс
                </p>
                <p style={{ fontSize: "36px", fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 8px", lineHeight: 1 }}>
                  {progress}%
                </p>
                <div style={{ width: "100%", height: "6px", backgroundColor: "var(--color-border)", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${progress}%`, backgroundColor: progressColor, borderRadius: "3px" }} />
                </div>
              </div>
            </div>

            {/* Assignments with scores */}
            <div style={{
              backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
              borderRadius: "14px", overflow: "hidden",
            }}>
              <div style={{
                padding: "18px 24px", borderBottom: "1px solid var(--color-border-card)",
                backgroundColor: "var(--color-bg-alt)",
              }}>
                <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--color-text-primary)", margin: 0 }}>
                  Задания и оценки
                </h2>
              </div>

              {assignments.length === 0 ? (
                <p style={{ padding: "32px 24px", color: "var(--color-text-subtle)", fontSize: "15px", textAlign: "center" }}>
                  Заданий пока нет.
                </p>
              ) : (
                <div>
                  {/* Header */}
                  <div style={{
                    display: "grid", gridTemplateColumns: "1fr 120px 120px",
                    padding: "10px 24px",
                    borderBottom: "1px solid var(--color-border-card)",
                    backgroundColor: "var(--color-card-alt)",
                  }}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-subtle)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Задание</span>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-subtle)", textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "center" }}>Дедлайн</span>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-subtle)", textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "center" }}>Балл</span>
                  </div>

                  {assignments.map((a, i) => {
                    const score = scores[a.id];
                    const hasScore = score !== undefined;
                    return (
                      <div
                        key={a.id}
                        style={{
                          display: "grid", gridTemplateColumns: "1fr 120px 120px",
                          padding: "16px 24px", alignItems: "center",
                          borderBottom: i < assignments.length - 1 ? "1px solid var(--color-border-card)" : "none",
                        }}
                      >
                        <div>
                          <p style={{ margin: 0, fontSize: "15px", fontWeight: 500, color: "var(--color-text-primary)" }}>{a.title}</p>
                          {a.comment && (
                            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--color-text-subtle)" }}>{a.comment.slice(0, 60)}{a.comment.length > 60 ? "…" : ""}</p>
                          )}
                        </div>
                        <p style={{ margin: 0, fontSize: "14px", color: "var(--color-text-light)", textAlign: "center" }}>
                          {a.deadline || "—"}
                        </p>
                        <div style={{ textAlign: "center" }}>
                          {hasScore ? (
                            <span style={{
                              display: "inline-block",
                              backgroundColor: score >= 70 ? "#ecfdf5" : score >= 40 ? "#fffbeb" : "#fef2f2",
                              border: `1px solid ${score >= 70 ? "#b5f5d7" : score >= 40 ? "#fde372" : "#fec7c7"}`,
                              borderRadius: "10px", padding: "4px 16px",
                              fontSize: "15px", fontWeight: 700,
                              color: score >= 70 ? "#0e3e12" : score >= 40 ? "#af3f00" : "#8f0000",
                            }}>
                              {score}
                            </span>
                          ) : (
                            <span style={{ fontSize: "14px", color: "var(--color-text-subtle)" }}>—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right — quick actions */}
          <div style={{
            width: "280px", flexShrink: 0,
            display: "flex", flexDirection: "column", gap: "14px",
          }}>
            <div style={{
              backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
              borderRadius: "14px", padding: "22px 20px",
            }}>
              <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 16px" }}>
                Действия
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <Link
                  href={`/dashboard/chat?student=${student.id}`}
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
                <button
                  onClick={() => router.push(`/dashboard/students?expand=${student.id}`)}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    backgroundColor: "var(--color-card)", color: "var(--color-accent)",
                    border: "1.5px solid var(--color-accent)", borderRadius: "10px",
                    height: "44px", padding: "0 18px",
                    fontSize: "15px", fontWeight: 600, cursor: "pointer", width: "100%",
                  }}
                >
                  <span>✏️</span> Изменить баллы
                </button>
              </div>
            </div>

            <div style={{
              backgroundColor: "var(--color-card-alt)", border: "1px solid var(--color-border-card)",
              borderRadius: "14px", padding: "20px",
            }}>
              <h3 style={{ fontSize: "15px", fontWeight: 600, color: "#0f1d74", margin: "0 0 10px" }}>
                Контакты
              </h3>
              <p style={{ fontSize: "14px", color: "var(--color-text-muted)", margin: "0 0 6px" }}>
                <strong>Telegram:</strong> {student.tg_username}
              </p>
              <p style={{ fontSize: "14px", color: "var(--color-text-muted)", margin: 0 }}>
                <strong>Email:</strong> {student.email}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
