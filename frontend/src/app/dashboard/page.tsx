"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getAssignments, getAddedStudents, deleteAssignment, calcStudentStats, type Assignment } from "@/lib/store";

// ── Student Dashboard ──────────────────────────────────────────────────────────

function StudentHome() {
  const [teacherAssignments, setTeacherAssignments] = useState<Assignment[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [avgScore, setAvgScore] = useState(0);

  useEffect(() => {
    setTeacherAssignments(getAssignments());
    const uid = sessionStorage.getItem("user_id") || localStorage.getItem("user_id") || "2";
    const stats = calcStudentStats(uid);
    setTotalScore(stats.total);
    setAvgScore(stats.avg);
  }, []);

  const inProgress = teacherAssignments.length;

  return (
    <div style={{ padding: "43px 45px 40px 45px", backgroundColor: "var(--color-bg)", minHeight: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "32px" }}>
        <div>
          <h1 style={{ fontSize: "40px", fontWeight: 700, color: "var(--color-text-primary)", margin: 0, lineHeight: "1.2" }}>
            С возвращением, Нурасыл!
          </h1>
          <p style={{ fontSize: "18px", color: "var(--color-text-muted)", margin: "10px 0 0" }}>
            {inProgress > 0
              ? `У вас ${inProgress} активных заданий от преподавателя.`
              : "Новых заданий пока нет. Ждите от преподавателя."}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Image src="/assets/icons/star-icon.png" alt="" width={39} height={39} className="object-contain" />
          <span style={{ fontSize: "31px", fontWeight: 600, color: "var(--color-text-primary)" }}>{totalScore}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: "24px" }}>
        {/* Assignments */}
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: "22px", fontWeight: 600, marginBottom: "16px", color: "var(--color-text-primary)" }}>Ваши задания</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {teacherAssignments.length === 0 ? (
              <div style={{
                backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
                borderRadius: "8px", padding: "32px 24px",
                textAlign: "center", color: "var(--color-text-subtle)",
              }}>
                <p style={{ fontSize: "18px", margin: 0 }}>Преподаватель ещё не добавил задания.</p>
              </div>
            ) : teacherAssignments.map((a) => (
              <div key={a.id} style={{
                backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
                borderRadius: "8px", padding: "18px 24px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", backgroundColor: "#eef2ff", border: "1.2px solid #d2dbfe", borderRadius: "14px", padding: "0 10px", height: "28px", fontSize: "13px", fontWeight: 500, color: "#3332ce" }}>
                    <Image src="/assets/icons/wait-icon.png" alt="" width={15} height={15} className="object-contain" />
                    В процессе
                  </span>
                  {a.deadline && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "15px", color: "var(--color-text-muted)" }}>
                      <Image src="/assets/icons/delivery-time.png" alt="" width={15} height={15} className="object-contain" />
                      Дедлайн: {a.deadline}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ fontSize: "22px", fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 4px" }}>{a.title}</p>
                    {a.comment && (
                      <p style={{ fontSize: "15px", color: "var(--color-text-muted)", margin: 0, maxWidth: "437px" }}>{a.comment}</p>
                    )}
                    <p style={{ fontSize: "13px", color: "var(--color-text-subtle)", margin: "6px 0 0" }}>Создано: {a.createdAt}</p>
                  </div>
                  <div style={{ display: "flex", gap: "10px", flexShrink: 0, marginLeft: "16px" }}>
                    <button
                      onClick={() => alert("Файл будет доступен после подключения бэкенда.")}
                      style={{
                        backgroundColor: "var(--color-card-subtle)", color: "var(--color-accent)",
                        border: "1.5px solid var(--color-accent)", borderRadius: "9px",
                        height: "35px", padding: "0 16px",
                        fontSize: "14px", fontWeight: 500, cursor: "pointer",
                        display: "flex", alignItems: "center", gap: "6px",
                      }}
                    >
                      📦 Скачать ZIP
                    </button>
                    <button style={{ backgroundColor: "var(--color-btn-primary-bg)", color: "var(--color-btn-primary-color)", border: "none", borderRadius: "9px", height: "35px", padding: "0 18px", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}>
                      Выполнить
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Progress sidebar */}
        <div style={{ width: "337px", flexShrink: 0, backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)", borderRadius: "15px", padding: "24px 24px 20px" }}>
          <h3 style={{ fontSize: "22px", fontWeight: 600, margin: "0 0 24px", color: "var(--color-text-primary)" }}>Мои результаты</h3>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
            <div style={{ position: "relative", width: "129px", height: "126px" }}>
              <svg width="129" height="126" viewBox="0 0 129 126">
                <circle cx="64" cy="63" r="54" fill="none" stroke="var(--color-border)" strokeWidth="12" />
                <circle cx="64" cy="63" r="54" fill="none" stroke="var(--color-progress-active)" strokeWidth="12"
                  strokeDasharray={`${2 * Math.PI * 54 * Math.min(avgScore / 10, 1)} ${2 * Math.PI * 54}`}
                  strokeDashoffset={2 * Math.PI * 54 * 0.25} strokeLinecap="round" />
              </svg>
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
                <div style={{ fontSize: "26px", fontWeight: 500, color: "var(--color-text-primary)" }}>{avgScore > 0 ? `${avgScore}` : "—"}</div>
                <div style={{ fontSize: "14px", color: "var(--color-text-muted)" }}>Средний</div>
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div style={{ backgroundColor: "var(--color-card-subtle)", borderRadius: "7px", padding: "14px 16px", textAlign: "center" }}>
              <div style={{ fontSize: "27px", fontWeight: 600, color: "var(--color-accent)" }}>{totalScore}</div>
              <div style={{ fontSize: "14px", color: "var(--color-text-muted)", marginTop: "4px" }}>Общий балл</div>
            </div>
            <div style={{ backgroundColor: "var(--color-card-subtle)", borderRadius: "7px", padding: "14px 16px", textAlign: "center" }}>
              <div style={{ fontSize: "27px", fontWeight: 600, color: "var(--color-accent)" }}>{teacherAssignments.length}</div>
              <div style={{ fontSize: "14px", color: "var(--color-text-muted)", marginTop: "4px" }}>Заданий</div>
            </div>
          </div>
          <div style={{ marginTop: "16px" }}>
            <Link href="/dashboard/chat" style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              backgroundColor: "var(--color-btn-primary-bg)", color: "var(--color-btn-primary-color)", textDecoration: "none",
              borderRadius: "10px", height: "42px", fontSize: "15px", fontWeight: 500,
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
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [studentCount, setStudentCount] = useState(0);
  const [topSearch, setTopSearch] = useState("");

  useEffect(() => {
    setAssignments(getAssignments());
    setStudentCount(getAddedStudents().length);
  }, []);

  const stats = [
    { label: "Всего студентов", value: String(studentCount), iconBg: "#efedf4", icon: "/assets/icons/people-icon.png" },
    { label: "Активные проблемы", value: "5", iconBg: "#ffdad6", icon: "/assets/icons/error-icon.png" },
    { label: "В стопоре", value: "3", iconBg: "#ffdbc7", icon: "/assets/icons/historical-icon.png" },
    { label: "Средняя успеваемость", value: "78%", iconBg: "#dfe0ff", icon: "/assets/icons/signal-icon.png" },
  ];

  const attention = [
    { id: "4", name: "Алинур Азат", initial: "Н", initialColor: "#4a1f00", attempts: "5+ попыток", time: "2 часа назад" },
    { id: "3", name: "Шералхан Мухаммад", initial: "М", initialColor: "#4648d4", attempts: "4 попытки", time: "5 часов назад" },
  ];

  const filteredAttention = attention.filter(s =>
    topSearch === "" || s.name.toLowerCase().includes(topSearch.toLowerCase())
  );

  return (
    <div style={{ backgroundColor: "var(--color-bg-alt)", minHeight: "100%" }}>
      {/* Top bar */}
      <div style={{ height: "70px", backgroundColor: "var(--color-topbar)", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", padding: "0 45px", gap: "16px" }}>
        <div style={{ flex: 1, maxWidth: "504px", backgroundColor: "var(--color-card-input)", borderRadius: "8px", height: "43px", display: "flex", alignItems: "center", gap: "10px", padding: "0 14px" }}>
          <Image src="/assets/icons/search-icon.png" alt="" width={22} height={22} className="object-contain" />
          <input
            value={topSearch}
            onChange={(e) => setTopSearch(e.target.value)}
            placeholder="Поиск студентов и заданий..."
            style={{ border: "none", outline: "none", background: "transparent", fontSize: "16px", color: "var(--color-text-muted)", flex: 1 }}
          />
        </div>
        <div style={{ marginLeft: "auto" }}>
          <Image src="/assets/icons/doorbell-icon.png" alt="" width={26} height={26} className="object-contain" />
        </div>
      </div>

      <div style={{ padding: "43px 45px 0" }}>
        <h1 style={{ fontSize: "40px", fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 8px" }}>
          Добро пожаловать, Нурасыл Мухамбеталы
        </h1>
        <p style={{ fontSize: "18px", color: "var(--color-text-light)", margin: "0 0 32px" }}>
          Вот краткий обзор текущей активности ваших студентов.
        </p>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "18px", marginBottom: "28px" }}>
          {stats.map((s) => (
            <div key={s.label} style={{ backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)", borderRadius: "15px", padding: "24px 20px 20px", position: "relative" }}>
              <div style={{ position: "absolute", top: "18px", right: "18px", backgroundColor: s.iconBg, borderRadius: "9px", width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Image src={s.icon} alt="" width={22} height={22} className="object-contain" />
              </div>
              <p style={{ fontSize: "15px", fontWeight: 500, color: "var(--color-text-light)", textTransform: "uppercase", margin: "0 0 48px", maxWidth: "130px" }}>{s.label}</p>
              <p style={{ fontSize: "41px", fontWeight: 700, color: "var(--color-text-primary)", margin: 0, lineHeight: "1" }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Attention + AI */}
        <div style={{ display: "flex", gap: "22px", marginBottom: "28px" }}>
          <div style={{ flex: 1, backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)", borderRadius: "13px", overflow: "hidden" }}>
            <div style={{ backgroundColor: "var(--color-bg-alt)", borderBottom: "1px solid var(--color-border-card)", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: "22.5px", fontWeight: 500, margin: 0, color: "var(--color-text-primary)" }}>Требуют внимания</p>
              <Link href="/dashboard/students" style={{ fontSize: "16px", color: "var(--color-accent)", textDecoration: "none", fontWeight: 500 }}>Смотреть всех</Link>
            </div>
            {filteredAttention.map((s, i) => (
              <div key={i} style={{ padding: "18px 24px", borderBottom: i < filteredAttention.length - 1 ? "1px solid var(--color-border-card)" : "none", display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ width: "56px", height: "56px", borderRadius: "50%", backgroundColor: "#f5e0c8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: "24px", fontWeight: 700, color: s.initialColor }}>{s.initial}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "18px", fontWeight: 500, margin: "0 0 4px", color: "var(--color-text-primary)" }}>{s.name}</p>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <span style={{ fontSize: "14.5px", color: "var(--color-text-light)" }}>Задание:</span>
                    <span style={{ fontSize: "14.5px", color: "var(--color-text-muted)" }}>Реализация бинарного поиска</span>
                  </div>
                  <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", backgroundColor: "#ffdad6", borderRadius: "12.5px", padding: "3px 10px", fontSize: "14px", color: "#b90000" }}>
                      <Image src="/assets/icons/high-importance.png" alt="" width={17} height={17} className="object-contain" />{s.attempts}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", backgroundColor: "var(--color-card-input)", borderRadius: "12.5px", padding: "3px 10px", fontSize: "14px", color: "var(--color-text-muted)" }}>
                      <Image src="/assets/icons/delivery-time.png" alt="" width={15} height={15} className="object-contain" />Последнее действие: {s.time}
                    </span>
                  </div>
                </div>
                <Link href={`/dashboard/chat?student=${s.id}`} style={{ backgroundColor: "var(--color-btn-primary-bg)", color: "var(--color-btn-primary-color)", textDecoration: "none", borderRadius: "10px", height: "35px", padding: "0 18px", fontSize: "16px", fontWeight: 500, flexShrink: 0, display: "inline-flex", alignItems: "center" }}>Написать</Link>
              </div>
            ))}
          </div>

          {/* AI Insights */}
          <div style={{ width: "336px", flexShrink: 0, backgroundColor: "var(--color-card-alt)", border: "1px solid var(--color-border-card)", borderRadius: "13px", padding: "24px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <Image src="/assets/icons/ai-icon.png" alt="" width={27} height={27} className="object-contain" />
              <p style={{ fontSize: "23px", fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>AI-Инсайты</p>
            </div>
            <p style={{ fontSize: "18px", lineHeight: "33px", margin: 0, color: "var(--color-text-primary)" }}>
              Система заметила, что <span style={{ fontWeight: 500, color: "var(--color-accent)" }}>40% группы</span> испытывают сложности. Рекомендуется провести дополнительный разбор этой темы.
            </p>
          </div>
        </div>

        {/* Assignments list */}
        <div style={{ marginBottom: "40px" }}>
          <div style={{ marginBottom: "16px" }}>
            <h2 style={{ fontSize: "22px", fontWeight: 600, margin: 0, color: "var(--color-text-primary)" }}>Мои задания</h2>
          </div>

          {assignments.length === 0 ? (
            <div style={{
              backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
              borderRadius: "13px", padding: "40px",
              textAlign: "center", color: "var(--color-text-subtle)",
            }}>
              <p style={{ fontSize: "18px", margin: 0 }}>Заданий пока нет. Нажмите «+ Новое задание», чтобы создать первое.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {assignments.map((a) => (
                <div key={a.id} style={{
                  backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
                  borderRadius: "13px", padding: "16px 24px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div>
                    <p style={{ fontSize: "18px", fontWeight: 600, margin: "0 0 4px", color: "var(--color-text-primary)" }}>{a.title}</p>
                    <p style={{ fontSize: "14px", color: "var(--color-text-subtle)", margin: 0 }}>
                      Дедлайн: {a.deadline || "—"} · Создано: {a.createdAt}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                    <span style={{
                      backgroundColor: "#eef2ff", border: "1px solid #d2dbfe",
                      borderRadius: "8px", padding: "4px 12px",
                      fontSize: "13px", color: "#3332ce",
                    }}>
                      Опубликовано
                    </span>
                    <button
                      onClick={() => { deleteAssignment(a.id); setAssignments(getAssignments()); }}
                      title="Удалить задание"
                      style={{
                        background: "none", border: "1px solid #fec7c7", borderRadius: "7px",
                        width: "34px", height: "34px", cursor: "pointer", fontSize: "15px",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#e53e3e", flexShrink: 0,
                      }}
                    >🗑</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function DashboardHome() {
  const [role, setRole] = useState<"student" | "teacher">("student");

  useEffect(() => {
    const saved = (sessionStorage.getItem("user_role") || localStorage.getItem("user_role")) as "student" | "teacher" | null;
    if (saved) setRole(saved);
  }, []);

  return role === "teacher" ? <TeacherHome /> : <StudentHome />;
}
