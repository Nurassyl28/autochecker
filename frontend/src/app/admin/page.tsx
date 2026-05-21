"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  adminGetUsers,
  adminCreateUser,
  adminDeleteUser,
  adminGetAssignments,
} from "@/lib/api";

interface User {
  id: number;
  email: string;
  full_name: string | null;
  role: "admin" | "teacher" | "student";
  tg_id: number | null;
  created_at: string;
}

interface Assignment {
  id: number;
  title: string;
  description_text: string | null;
  spec_status: "pending" | "ready" | "error";
  created_at: string;
}

type Tab = "users" | "assignments";

const ROLE_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  admin:   { label: "Админ",      bg: "#ede9fe", color: "#6d28d9" },
  teacher: { label: "Учитель",    bg: "#dbeafe", color: "#1d4ed8" },
  student: { label: "Студент",    bg: "#dcfce7", color: "#15803d" },
};

const SPEC_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: "⏳ Генерация...", bg: "#fef9c3", color: "#a16207" },
  ready:   { label: "✅ Готово",       bg: "#dcfce7", color: "#15803d" },
  error:   { label: "❌ Ошибка",       bg: "#fee2e2", color: "#b91c1c" },
};

function initials(u: User) {
  const name = u.full_name || u.email;
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ["#1976d2","#e91e63","#4caf50","#9c27b0","#ff9800","#f44336","#00bcd4","#795548"];

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("users");

  // ── Users ──────────────────────────────────────────────────────────────────
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", password: "", full_name: "", role: "student" as "teacher" | "student" });
  const [createUserLoading, setCreateUserLoading] = useState(false);
  const [createUserError, setCreateUserError] = useState("");

  // ── Assignments ────────────────────────────────────────────────────────────
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);

  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [newAssignment, setNewAssignment] = useState({ title: "", description_text: "" });
  const [createAssignmentLoading, setCreateAssignmentLoading] = useState(false);
  const [createAssignmentError, setCreateAssignmentError] = useState("");

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!localStorage.getItem("admin_logged_in")) {
      router.replace("/admin/login");
    }
  }, [router]);

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    const res = await adminGetUsers();
    if (res.ok) setUsers(await res.json());
    setUsersLoading(false);
  }, []);

  const loadAssignments = useCallback(async () => {
    setAssignmentsLoading(true);
    const res = await adminGetAssignments();
    if (res.ok) setAssignments(await res.json());
    setAssignmentsLoading(false);
  }, []);

  useEffect(() => { loadUsers(); loadAssignments(); }, [loadUsers, loadAssignments]);

  // ── Create user ────────────────────────────────────────────────────────────
  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateUserLoading(true);
    setCreateUserError("");
    const res = await adminCreateUser(newUser);
    if (res.ok) {
      setShowCreateUser(false);
      setNewUser({ email: "", password: "", full_name: "", role: "student" });
      await loadUsers();
    } else {
      const err = await res.json().catch(() => ({}));
      setCreateUserError((err as { detail?: string }).detail || "Ошибка создания");
    }
    setCreateUserLoading(false);
  }

  // ── Delete user ────────────────────────────────────────────────────────────
  async function handleDeleteUser(id: number, email: string) {
    if (!confirm(`Удалить пользователя ${email}?`)) return;
    await adminDeleteUser(id);
    await loadUsers();
  }

  // ── Create assignment ──────────────────────────────────────────────────────
  async function handleCreateAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (!newAssignment.title.trim() || !newAssignment.description_text.trim()) {
      setCreateAssignmentError("Заполните название и описание");
      return;
    }
    setCreateAssignmentLoading(true);
    setCreateAssignmentError("");
    const token = localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token");
    const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const r = await fetch(`${BASE}/admin/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(newAssignment),
    });
    if (r.ok) {
      setShowCreateAssignment(false);
      setNewAssignment({ title: "", description_text: "" });
      await loadAssignments();
    } else {
      const err = await r.json().catch(() => ({}));
      setCreateAssignmentError((err as { detail?: string }).detail || "Ошибка создания");
    }
    setCreateAssignmentLoading(false);
  }

  // ── Delete assignment ──────────────────────────────────────────────────────
  async function handleDeleteAssignment(id: number, title: string) {
    if (!confirm(`Удалить задание "${title}"?`)) return;
    const token = localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token");
    const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    await fetch(`${BASE}/admin/assignments/${id}`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    await loadAssignments();
  }

  const btnBase: React.CSSProperties = {
    height: "38px", padding: "0 18px", borderRadius: "8px",
    fontSize: "14px", fontWeight: 600, cursor: "pointer", border: "none",
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f5f6fa", fontFamily: "Inter, sans-serif" }}>

      {/* Header */}
      <div style={{ backgroundColor: "white", borderBottom: "1px solid #e5e7eb", padding: "0 40px", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "36px", height: "36px", backgroundColor: "#142175", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>🛡</div>
          <span style={{ fontSize: "18px", fontWeight: 700, color: "#111" }}>Autochecker Admin</span>
        </div>
        <button
          onClick={() => { localStorage.removeItem("admin_logged_in"); router.push("/admin/login"); }}
          style={{ ...btnBase, backgroundColor: "#fef2f2", color: "#e53e3e" }}
        >
          Выйти
        </button>
      </div>

      <div style={{ padding: "32px 40px" }}>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "24px", backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "4px", width: "fit-content" }}>
          {([["users", "👤 Пользователи"], ["assignments", "📋 Задания"]] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                ...btnBase,
                backgroundColor: tab === key ? "#142175" : "transparent",
                color: tab === key ? "white" : "#555",
                border: "none",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── USERS TAB ── */}
        {tab === "users" && (
          <div style={{ backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>

            {/* Toolbar */}
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: 0 }}>
                Пользователи ({users.length})
              </h2>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={loadUsers} style={{ ...btnBase, backgroundColor: "#f3f4f6", color: "#374151" }}>↻ Обновить</button>
                <button onClick={() => setShowCreateUser(true)} style={{ ...btnBase, backgroundColor: "#142175", color: "white" }}>+ Добавить</button>
              </div>
            </div>

            {/* Create user modal */}
            {showCreateUser && (
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #e5e7eb", backgroundColor: "#f9fafb" }}>
                <h3 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 16px", color: "#111" }}>Новый пользователь</h3>
                <form onSubmit={handleCreateUser} style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end" }}>
                  {[
                    { key: "full_name", placeholder: "Полное имя", type: "text" },
                    { key: "email",     placeholder: "Email",      type: "email" },
                    { key: "password",  placeholder: "Пароль",     type: "password" },
                  ].map(({ key, placeholder, type }) => (
                    <input
                      key={key}
                      type={type}
                      placeholder={placeholder}
                      required
                      value={(newUser as Record<string, string>)[key]}
                      onChange={(e) => setNewUser((p) => ({ ...p, [key]: e.target.value }))}
                      style={{ height: "38px", padding: "0 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", outline: "none", minWidth: "180px" }}
                    />
                  ))}
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value as "teacher" | "student" }))}
                    style={{ height: "38px", padding: "0 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", outline: "none" }}
                  >
                    <option value="student">Студент</option>
                    <option value="teacher">Учитель</option>
                  </select>
                  <button type="submit" disabled={createUserLoading} style={{ ...btnBase, backgroundColor: "#142175", color: "white", opacity: createUserLoading ? 0.6 : 1 }}>
                    {createUserLoading ? "Создаём..." : "Создать"}
                  </button>
                  <button type="button" onClick={() => { setShowCreateUser(false); setCreateUserError(""); }} style={{ ...btnBase, backgroundColor: "#f3f4f6", color: "#374151" }}>
                    Отмена
                  </button>
                </form>
                {createUserError && <p style={{ color: "#e53e3e", fontSize: "13px", margin: "8px 0 0" }}>{createUserError}</p>}
              </div>
            )}

            {/* Table header */}
            <div style={{ display: "grid", gridTemplateColumns: "40px 2fr 2fr 120px 150px 80px", padding: "10px 24px", backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
              {["", "Имя / Email", "Telegram ID", "Роль", "Дата создания", ""].map((h, i) => (
                <span key={i} style={{ fontSize: "12px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.4px" }}>{h}</span>
              ))}
            </div>

            {usersLoading ? (
              <div style={{ padding: "48px", textAlign: "center", color: "#9ca3af" }}>Загрузка...</div>
            ) : users.length === 0 ? (
              <div style={{ padding: "48px", textAlign: "center", color: "#9ca3af" }}>Пользователей нет</div>
            ) : users.map((u, i) => {
              const roleInfo = ROLE_LABELS[u.role] ?? ROLE_LABELS.student;
              const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
              return (
                <div
                  key={u.id}
                  style={{ display: "grid", gridTemplateColumns: "40px 2fr 2fr 120px 150px 80px", padding: "12px 24px", alignItems: "center", borderBottom: i < users.length - 1 ? "1px solid #f3f4f6" : "none" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fafafa")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "white" }}>{initials(u)}</span>
                  </div>
                  <div>
                    <p style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: 600, color: "#111" }}>{u.full_name || "—"}</p>
                    <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>{u.email}</p>
                  </div>
                  <span style={{ fontSize: "13px", color: "#6b7280" }}>{u.tg_id ?? "—"}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", height: "24px", padding: "0 10px", borderRadius: "12px", fontSize: "12px", fontWeight: 600, backgroundColor: roleInfo.bg, color: roleInfo.color }}>
                    {roleInfo.label}
                  </span>
                  <span style={{ fontSize: "13px", color: "#6b7280" }}>{u.created_at.slice(0, 10)}</span>
                  {u.role !== "admin" ? (
                    <button
                      onClick={() => handleDeleteUser(u.id, u.email)}
                      style={{ ...btnBase, height: "30px", padding: "0 12px", backgroundColor: "#fee2e2", color: "#b91c1c", fontSize: "12px" }}
                    >
                      Удалить
                    </button>
                  ) : <span />}
                </div>
              );
            })}
          </div>
        )}

        {/* ── ASSIGNMENTS TAB ── */}
        {tab === "assignments" && (
          <div style={{ backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>

            {/* Toolbar */}
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: 0 }}>
                Задания ({assignments.length})
              </h2>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={loadAssignments} style={{ ...btnBase, backgroundColor: "#f3f4f6", color: "#374151" }}>↻ Обновить</button>
                <button onClick={() => setShowCreateAssignment(true)} style={{ ...btnBase, backgroundColor: "#142175", color: "white" }}>+ Добавить</button>
              </div>
            </div>

            {/* Create assignment form */}
            {showCreateAssignment && (
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #e5e7eb", backgroundColor: "#f9fafb" }}>
                <h3 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 16px", color: "#111" }}>Новое задание</h3>
                <form onSubmit={handleCreateAssignment} style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "640px" }}>
                  <input
                    type="text"
                    placeholder="Название задания (например: Lab 1 — Hello World)"
                    required
                    value={newAssignment.title}
                    onChange={(e) => setNewAssignment((p) => ({ ...p, title: e.target.value }))}
                    style={{ height: "40px", padding: "0 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", outline: "none" }}
                  />
                  <textarea
                    placeholder="Описание задания — LLM автоматически сгенерирует критерии проверки на основе этого текста..."
                    required
                    rows={5}
                    value={newAssignment.description_text}
                    onChange={(e) => setNewAssignment((p) => ({ ...p, description_text: e.target.value }))}
                    style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", outline: "none", resize: "vertical", fontFamily: "inherit" }}
                  />
                  <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>
                    💡 После создания LLM автоматически сгенерирует spec (критерии). Статус изменится на «Готово» через несколько секунд (нужен реальный LLM ключ).
                  </p>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button type="submit" disabled={createAssignmentLoading} style={{ ...btnBase, backgroundColor: "#142175", color: "white", opacity: createAssignmentLoading ? 0.6 : 1 }}>
                      {createAssignmentLoading ? "Создаём..." : "Создать задание"}
                    </button>
                    <button type="button" onClick={() => { setShowCreateAssignment(false); setCreateAssignmentError(""); }} style={{ ...btnBase, backgroundColor: "#f3f4f6", color: "#374151" }}>
                      Отмена
                    </button>
                  </div>
                  {createAssignmentError && <p style={{ color: "#e53e3e", fontSize: "13px", margin: 0 }}>{createAssignmentError}</p>}
                </form>
              </div>
            )}

            {/* Table header */}
            <div style={{ display: "grid", gridTemplateColumns: "60px 3fr 140px 150px 80px", padding: "10px 24px", backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
              {["ID", "Название", "Статус spec", "Дата создания", ""].map((h, i) => (
                <span key={i} style={{ fontSize: "12px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.4px" }}>{h}</span>
              ))}
            </div>

            {assignmentsLoading ? (
              <div style={{ padding: "48px", textAlign: "center", color: "#9ca3af" }}>Загрузка...</div>
            ) : assignments.length === 0 ? (
              <div style={{ padding: "48px", textAlign: "center", color: "#9ca3af" }}>
                Заданий нет. Нажмите «+ Добавить» чтобы создать первое.
              </div>
            ) : assignments.map((a, i) => {
              const spec = SPEC_LABELS[a.spec_status] ?? SPEC_LABELS.pending;
              return (
                <div
                  key={a.id}
                  style={{ display: "grid", gridTemplateColumns: "60px 3fr 140px 150px 80px", padding: "14px 24px", alignItems: "center", borderBottom: i < assignments.length - 1 ? "1px solid #f3f4f6" : "none" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fafafa")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <span style={{ fontSize: "13px", color: "#9ca3af", fontFamily: "monospace" }}>#{a.id}</span>
                  <div>
                    <p style={{ margin: "0 0 3px", fontSize: "15px", fontWeight: 600, color: "#111" }}>{a.title}</p>
                    {a.description_text && (
                      <p style={{ margin: 0, fontSize: "12px", color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "420px" }}>
                        {a.description_text.slice(0, 100)}...
                      </p>
                    )}
                  </div>
                  <span style={{ display: "inline-flex", alignItems: "center", height: "26px", padding: "0 10px", borderRadius: "13px", fontSize: "12px", fontWeight: 600, backgroundColor: spec.bg, color: spec.color, whiteSpace: "nowrap" }}>
                    {spec.label}
                  </span>
                  <span style={{ fontSize: "13px", color: "#6b7280" }}>{a.created_at.slice(0, 10)}</span>
                  <button
                    onClick={() => handleDeleteAssignment(a.id, a.title)}
                    style={{ ...btnBase, height: "30px", padding: "0 12px", backgroundColor: "#fee2e2", color: "#b91c1c", fontSize: "12px" }}
                  >
                    Удалить
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
