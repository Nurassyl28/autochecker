"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getAllTgStudents,
  getAddedStudents,
  addStudent,
  getAssignments,
  saveScores,
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

export default function StudentsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | StudentStatus>("all");
  const [students, setStudents] = useState<TgStudent[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [stats, setStats] = useState<Record<string, { avg: number; total: number }>>({});

  const router = useRouter();

  const [showAddModal, setShowAddModal] = useState(false);
  const [allTgStudents, setAllTgStudents] = useState<TgStudent[]>([]);
  const [modalSearch, setModalSearch] = useState("");

  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [scoreInputs, setScoreInputs] = useState<Record<string, number>>({});

  function loadData() {
    const added = getAddedStudents();
    setStudents(added);
    const assigns = getAssignments();
    setAssignments(assigns);
    const s: Record<string, { avg: number; total: number }> = {};
    added.forEach((st) => {
      s[st.id] = calcStudentStats(st.id);
    });
    setStats(s);
  }

  useEffect(() => {
    loadData();
    setAllTgStudents(getAllTgStudents());
  }, []);

  function handleAddStudent(s: TgStudent) {
    addStudent(s);
    loadData();
    setAllTgStudents(getAllTgStudents());
  }

  function handleExpand(studentId: string) {
    if (expandedStudent === studentId) {
      setExpandedStudent(null);
      setScoreInputs({});
    } else {
      setExpandedStudent(studentId);
      setScoreInputs(getStudentScores(studentId));
    }
  }

  function handleConfirmScores(studentId: string) {
    saveScores(studentId, scoreInputs);
    loadData();
    setExpandedStudent(null);
    setScoreInputs({});
  }

  const tgAvailable = allTgStudents.filter(
    (tg) => !students.find((s) => s.id === tg.id)
  );
  const tgFiltered = tgAvailable.filter((s) =>
    s.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
    s.tg_username.toLowerCase().includes(modalSearch.toLowerCase())
  );

  const filtered = students.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const st = stats[s.id] || { avg: 0, total: 0 };
    const status = getStatus(st.avg, st.total);
    const matchFilter = filter === "all" || status === filter;
    return matchSearch && matchFilter;
  });

  const totalCount = students.length;
  const activeCount = students.filter((s) => {
    const st = stats[s.id] || { avg: 0, total: 0 };
    return getStatus(st.avg, st.total) === "active";
  }).length;
  const stuckCount = students.filter((s) => {
    const st = stats[s.id] || { avg: 0, total: 0 };
    return getStatus(st.avg, st.total) === "stuck";
  }).length;

  return (
    <div style={{ padding: "43px 45px", backgroundColor: "var(--color-bg-alt)", minHeight: "100%" }}>

      {/* Add Student Modal */}
      {showAddModal && (
        <div
          style={{
            position: "fixed", inset: 0,
            backgroundColor: "rgba(0,0,0,0.55)",
            zIndex: 200,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={() => { setShowAddModal(false); setModalSearch(""); }}
        >
          <div
            style={{
              backgroundColor: "var(--color-card)", borderRadius: "16px",
              width: "520px", maxHeight: "75vh",
              display: "flex", flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{
              padding: "22px 26px 16px",
              borderBottom: "1px solid var(--color-border)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 4px" }}>
                  Добавить студента
                </h2>
                <p style={{ fontSize: "13px", color: "var(--color-text-subtle)", margin: 0 }}>
                  Зарегистрированные через Telegram-бот
                </p>
              </div>
              <button
                onClick={() => { setShowAddModal(false); setModalSearch(""); }}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: "24px", color: "var(--color-text-subtle)", lineHeight: 1,
                }}
              >×</button>
            </div>

            {/* Search inside modal */}
            <div style={{ padding: "14px 26px", borderBottom: "1px solid var(--color-border-card)" }}>
              <div style={{
                backgroundColor: "var(--color-card-subtle)",
                border: "1px solid var(--color-border-card)",
                borderRadius: "8px", height: "40px",
                display: "flex", alignItems: "center", gap: "8px", padding: "0 12px",
              }}>
                <span style={{ fontSize: "15px", opacity: 0.5 }}>🔍</span>
                <input
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Поиск по имени или @username..."
                  style={{
                    border: "none", outline: "none", background: "transparent",
                    fontSize: "14px", color: "var(--color-text-primary)", flex: 1,
                  }}
                />
              </div>
            </div>

            {/* Student list */}
            <div style={{ overflowY: "auto", flex: 1 }}>
              {tgFiltered.length === 0 ? (
                <p style={{ padding: "28px 26px", color: "var(--color-text-subtle)", fontSize: "15px", textAlign: "center" }}>
                  {tgAvailable.length === 0
                    ? "Все студенты уже добавлены в ваш класс."
                    : "Студенты не найдены."}
                </p>
              ) : tgFiltered.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: "flex", alignItems: "center", gap: "14px",
                    padding: "12px 26px",
                    borderBottom: "1px solid var(--color-card-subtle)",
                    transition: "background 0.1s",
                  }}
                >
                  <div style={{
                    width: "46px", height: "46px", borderRadius: "50%",
                    backgroundColor: "var(--color-card-input)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <span style={{ fontSize: "17px", fontWeight: 700, color: "var(--color-accent)" }}>{s.initial}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: "0 0 2px", fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)" }}>{s.name}</p>
                    <p style={{ margin: 0, fontSize: "12px", color: "var(--color-text-subtle)" }}>
                      {s.tg_username}&nbsp;&nbsp;·&nbsp;&nbsp;{s.email}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAddStudent(s)}
                    style={{
                      backgroundColor: "var(--color-btn-primary-bg)", color: "var(--color-btn-primary-color)",
                      border: "none", borderRadius: "8px",
                      height: "36px", padding: "0 18px",
                      fontSize: "13px", fontWeight: 600, cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    + Добавить
                  </button>
                </div>
              ))}
            </div>

            <div style={{
              padding: "14px 26px",
              borderTop: "1px solid var(--color-border)",
              display: "flex", justifyContent: "flex-end",
            }}>
              <button
                onClick={() => { setShowAddModal(false); setModalSearch(""); }}
                style={{
                  backgroundColor: "var(--color-card)", color: "var(--color-text-muted)",
                  border: "1px solid var(--color-border)", borderRadius: "8px",
                  height: "38px", padding: "0 22px",
                  fontSize: "14px", cursor: "pointer",
                }}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

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
              placeholder="Поиск по имени..."
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

          <button
            onClick={() => setShowAddModal(true)}
            style={{
              backgroundColor: "var(--color-btn-primary-bg)", border: "none",
              borderRadius: "8px", height: "44px", padding: "0 24px",
              color: "var(--color-btn-primary-color)", fontSize: "16px", fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            + Добавить студента
          </button>
        </div>

        {/* Student rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filtered.length === 0 && (
            <div style={{
              backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
              borderRadius: "9px", padding: "48px",
              textAlign: "center", color: "var(--color-text-subtle)", fontSize: "16px",
            }}>
              {students.length === 0
                ? 'Нет студентов. Нажмите "+ Добавить студента", чтобы добавить.'
                : "Студенты не найдены."}
            </div>
          )}

          {filtered.map((s) => {
            const st = stats[s.id] || { avg: 0, total: 0 };
            const status = getStatus(st.avg, st.total);
            const statusInfo = STATUS_LABELS[status];
            const isExpanded = expandedStudent === s.id;
            const progressColor = status === "active" ? "var(--color-progress-active)" : status === "stuck" ? "#ba1a1a" : "#f59e0b";
            const gradedCount = Object.keys(getStudentScores(s.id)).length;
            const progress = assignments.length > 0 ? Math.round((gradedCount / assignments.length) * 100) : 0;

            return (
              <div
                key={s.id}
                style={{
                  backgroundColor: "var(--color-card)",
                  border: `1px solid ${status === "stuck" ? "#efcbca" : "var(--color-border-card)"}`,
                  borderRadius: "9px",
                  overflow: "hidden",
                }}
              >
                {/* Main row */}
                <div style={{
                  padding: "0 22px", height: "96px",
                  display: "flex", alignItems: "center", gap: "20px",
                }}>
                  {/* Avatar + Name */}
                  <div
                    onClick={() => router.push(`/dashboard/students/${s.id}`)}
                    style={{
                      display: "flex", alignItems: "center", gap: "14px",
                      cursor: "pointer", flexShrink: 0,
                    }}
                  >
                    <div style={{
                      width: "55px", height: "55px", borderRadius: "50%",
                      backgroundColor: "#e8e4f0",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-accent)" }}>{s.initial}</span>
                    </div>
                    <div style={{ width: "155px" }}>
                      <p style={{ fontSize: "17px", fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 4px", textDecoration: "underline", textDecorationColor: "transparent", transition: "text-decoration-color 0.15s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.textDecorationColor = "var(--color-accent)")}
                        onMouseLeave={(e) => (e.currentTarget.style.textDecorationColor = "transparent")}
                      >{s.name}</p>
                      <span style={{ fontSize: "13px", color: "var(--color-text-subtle)" }}>{s.tg_username}</span>
                    </div>
                  </div>

                  <div style={{ width: "1px", height: "53px", backgroundColor: "var(--color-border-card)", flexShrink: 0 }} />

                  {/* Progress */}
                  <div style={{ width: "200px", flexShrink: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ fontSize: "13px", color: "var(--color-text-light)" }}>Прогресс</span>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: status === "active" ? "var(--color-accent)" : "var(--color-text-muted)" }}>
                        {progress}%
                      </span>
                    </div>
                    <div style={{ width: "100%", height: "7px", backgroundColor: "var(--color-border)", borderRadius: "3.5px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${progress}%`, backgroundColor: progressColor, borderRadius: "3.5px" }} />
                    </div>
                  </div>

                  <div style={{ width: "1px", height: "53px", backgroundColor: "var(--color-border-card)", flexShrink: 0 }} />

                  {/* Scores */}
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "13px", color: "var(--color-text-light)", margin: "0 0 4px" }}>Средний / Общий балл</p>
                    <p style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
                      {st.avg}&nbsp;&nbsp;/&nbsp;&nbsp;{st.total.toLocaleString("ru")}
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

                  {/* Expand + button */}
                  <button
                    onClick={() => handleExpand(s.id)}
                    title="Выставить баллы"
                    style={{
                      width: "34px", height: "34px",
                      backgroundColor: isExpanded ? "var(--color-card-input)" : "var(--color-card-subtle)",
                      border: `1px solid ${isExpanded ? "var(--color-border)" : "var(--color-border-card)"}`,
                      borderRadius: "8px", cursor: "pointer",
                      fontSize: "20px", fontWeight: 700, color: "var(--color-accent)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, transition: "background 0.15s",
                    }}
                  >
                    {isExpanded ? "−" : "+"}
                  </button>
                </div>

                {/* Score dropdown panel */}
                {isExpanded && (
                  <div style={{
                    borderTop: "1.5px solid var(--color-border-card)",
                    backgroundColor: "var(--color-card-alt)",
                    padding: "22px 26px 24px",
                  }}>
                    <p style={{ fontSize: "16px", fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 16px" }}>
                      Баллы по заданиям — {s.name}
                    </p>

                    {assignments.length === 0 ? (
                      <p style={{ fontSize: "14px", color: "var(--color-text-subtle)", marginBottom: "18px" }}>
                        Нет созданных заданий. Сначала создайте задание.
                      </p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                        {assignments.map((a) => (
                          <div
                            key={a.id}
                            style={{
                              display: "flex", alignItems: "center",
                              justifyContent: "space-between",
                              backgroundColor: "var(--color-card)",
                              border: "1px solid var(--color-border-card)",
                              borderRadius: "10px", padding: "14px 18px",
                            }}
                          >
                            <div>
                              <p style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)" }}>{a.title}</p>
                              {a.deadline && (
                                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--color-text-subtle)" }}>Дедлайн: {a.deadline}</p>
                              )}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <span style={{ fontSize: "13px", color: "var(--color-text-light)" }}>Балл:</span>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={scoreInputs[a.id] !== undefined ? scoreInputs[a.id] : ""}
                                onChange={(e) =>
                                  setScoreInputs((prev) => ({
                                    ...prev,
                                    [a.id]: Number(e.target.value),
                                  }))
                                }
                                placeholder="0–100"
                                style={{
                                  width: "80px", height: "38px",
                                  border: "1.5px solid var(--color-border-input)", borderRadius: "8px",
                                  textAlign: "center", fontSize: "15px", fontWeight: 600, color: "var(--color-accent)",
                                  outline: "none", backgroundColor: "var(--color-card)",
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                      <button
                        onClick={() => { setExpandedStudent(null); setScoreInputs({}); }}
                        style={{
                          backgroundColor: "var(--color-card)", color: "var(--color-text-muted)",
                          border: "1px solid var(--color-border)", borderRadius: "8px",
                          height: "42px", padding: "0 22px",
                          fontSize: "15px", cursor: "pointer",
                        }}
                      >
                        Отмена
                      </button>
                      <button
                        onClick={() => handleConfirmScores(s.id)}
                        style={{
                          backgroundColor: "var(--color-btn-primary-bg)", color: "var(--color-btn-primary-color)",
                          border: "none", borderRadius: "8px",
                          height: "42px", padding: "0 32px",
                          fontSize: "15px", fontWeight: 700, cursor: "pointer",
                        }}
                      >
                        Подтвердить
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filtered.length > 3 && (
          <div style={{ textAlign: "center", marginTop: "16px" }}>
            <a href="#" style={{ fontSize: "15.5px", color: "var(--color-text-muted)", textDecoration: "none" }}>Посмотреть все</a>
          </div>
        )}
      </div>
    </div>
  );
}
