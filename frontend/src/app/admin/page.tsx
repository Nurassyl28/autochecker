"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { adminGetUsers, adminCreateUser, adminDeleteUser, getToken } from "@/lib/api";
import AdminClasses from "./classes";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
  spec_status: "pending" | "generating" | "ready" | "failed";
  llm_spec: { checks?: { id: string; description: string; weight: number }[] } | null;
  created_by: number | null;
  created_at: string;
}

interface ClassItem {
  id: number;
  name: string;
}

interface Submission {
  id: number;
  assignment_id: number;
  student_id: number;
  repo_url: string;
  status: string;
  pass_fail: "pass" | "fail" | null;
  score: number | null;
  created_at: string;
}

type Tab = "users" | "assignments" | "submissions" | "classes";

const ROLE_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  admin:   { label: "Админ",    bg: "#ede9fe", color: "#6d28d9" },
  teacher: { label: "Учитель",  bg: "#dbeafe", color: "#1d4ed8" },
  student: { label: "Студент",  bg: "#dcfce7", color: "#15803d" },
};

const SPEC_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  pending:    { label: "⏳ Ожидание",  bg: "#fef9c3", color: "#a16207" },
  generating: { label: "🔄 Генерация", bg: "#eff6ff", color: "#1d4ed8" },
  ready:      { label: "✅ Готово",    bg: "#dcfce7", color: "#15803d" },
  failed:     { label: "❌ Ошибка",    bg: "#fee2e2", color: "#b91c1c" },
};

const SUB_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  pending:    { label: "Ожидание",   bg: "#fef9c3", color: "#a16207" },
  processing: { label: "Проверяется",bg: "#eff6ff", color: "#1d4ed8" },
  done:       { label: "Готово",     bg: "#dcfce7", color: "#15803d" },
  error:      { label: "Ошибка",     bg: "#fee2e2", color: "#b91c1c" },
};

function initials(u: User) {
  const name = u.full_name || u.email;
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ["#1976d2","#e91e63","#4caf50","#9c27b0","#ff9800","#f44336","#00bcd4","#795548"];

function adminHeaders(extra: Record<string, string> = {}): HeadersInit {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}`, ...extra } : extra;
}

export default function AdminPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>("users");

  // Users
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", password: "", full_name: "", role: "student" as "teacher" | "student" });
  const [createUserLoading, setCreateUserLoading] = useState(false);
  const [createUserError, setCreateUserError] = useState("");

  // Classes (for assignment selector)
  const [classes, setClasses] = useState<ClassItem[]>([]);

  // Assignments
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [assignMode, setAssignMode] = useState<"text" | "file">("text");
  const [newAssignment, setNewAssignment] = useState({ title: "", description_text: "", reference_solution: "", class_id: "" });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [refSolMode, setRefSolMode] = useState<"text" | "file">("text");
  const [refSolFile, setRefSolFile] = useState<File | null>(null);
  const refSolFileRef = useRef<HTMLInputElement>(null);
  const [createAssignmentLoading, setCreateAssignmentLoading] = useState(false);
  const [createAssignmentError, setCreateAssignmentError] = useState("");
  const [expandedSpec, setExpandedSpec] = useState<number | null>(null);

  // Edit user
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ email: "", password: "" });
  const [editUserLoading, setEditUserLoading] = useState(false);
  const [editUserError, setEditUserError] = useState("");

  // Submissions
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!localStorage.getItem("admin_logged_in")) router.replace("/admin/login");
  }, [router]);

  // Load data
  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    const res = await adminGetUsers();
    if (res.ok) setUsers(await res.json());
    setUsersLoading(false);
  }, []);

  const loadAssignments = useCallback(async () => {
    setAssignmentsLoading(true);
    const res = await fetch(`${BASE_URL}/admin/assignments`, { headers: adminHeaders() });
    if (res.ok) setAssignments(await res.json());
    setAssignmentsLoading(false);
  }, []);

  const loadClasses = useCallback(async () => {
    const res = await fetch(`${BASE_URL}/admin/classes`, { headers: adminHeaders() });
    if (res.ok) {
      const data = await res.json();
      setClasses(data.map((c: { id: number; name: string }) => ({ id: c.id, name: c.name })));
    }
  }, []);

  const loadSubmissions = useCallback(async () => {
    setSubsLoading(true);
    const res = await fetch(`${BASE_URL}/admin/submissions`, { headers: adminHeaders() });
    if (res.ok) setSubmissions(await res.json());
    setSubsLoading(false);
  }, []);

  useEffect(() => {
    loadUsers();
    loadAssignments();
    loadClasses();
  }, [loadUsers, loadAssignments, loadClasses]);

  useEffect(() => {
    if (tab === "submissions") loadSubmissions();
  }, [tab, loadSubmissions]);

  // Create user
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
      const detail = (err as { detail?: unknown }).detail;
      setCreateUserError(
        typeof detail === "string" ? detail
        : Array.isArray(detail) ? detail.map((d: { msg?: string }) => d.msg ?? "").join("; ")
        : "Ошибка создания пользователя"
      );
    }
    setCreateUserLoading(false);
  }

  async function handleDeleteUser(id: number, email: string) {
    if (!confirm(`Удалить пользователя ${email}?`)) return;
    await adminDeleteUser(id);
    await loadUsers();
  }

  async function handleEditUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUserId) return;
    setEditUserLoading(true);
    setEditUserError("");
    const body: Record<string, string> = {};
    if (editForm.email.trim()) body.email = editForm.email.trim();
    if (editForm.password.trim()) body.password = editForm.password.trim();
    const res = await fetch(`${BASE_URL}/admin/users/${editingUserId}`, {
      method: "PATCH",
      headers: adminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setEditingUserId(null);
      setEditForm({ email: "", password: "" });
      await loadUsers();
    } else {
      const err = await res.json().catch(() => ({}));
      const detail = (err as { detail?: unknown }).detail;
      setEditUserError(typeof detail === "string" ? detail : "Ошибка обновления");
    }
    setEditUserLoading(false);
  }

  // Create assignment
  async function handleCreateAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (!newAssignment.title.trim()) { setCreateAssignmentError("Введите название"); return; }
    setCreateAssignmentLoading(true);
    setCreateAssignmentError("");

    let res: Response;
    if (assignMode === "file" && uploadFile) {
      const fd = new FormData();
      fd.append("title", newAssignment.title.trim());
      fd.append("file", uploadFile);
      if (newAssignment.class_id) fd.append("class_id", newAssignment.class_id);
      if (refSolMode === "file" && refSolFile) {
        fd.append("reference_solution_file", refSolFile);
      } else if (newAssignment.reference_solution.trim()) {
        fd.append("reference_solution", newAssignment.reference_solution.trim());
      }
      res = await fetch(`${BASE_URL}/admin/assignments/upload`, { method: "POST", headers: adminHeaders(), body: fd });
    } else {
      if (!newAssignment.description_text.trim()) { setCreateAssignmentError("Введите описание"); setCreateAssignmentLoading(false); return; }
      res = await fetch(`${BASE_URL}/admin/assignments`, {
        method: "POST",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          title: newAssignment.title.trim(),
          description_text: newAssignment.description_text.trim(),
          reference_solution: newAssignment.reference_solution.trim() || null,
          class_id: newAssignment.class_id ? Number(newAssignment.class_id) : null,
        }),
      });
    }

    if (res.ok) {
      setShowCreateAssignment(false);
      setNewAssignment({ title: "", description_text: "", reference_solution: "", class_id: "" });
      setUploadFile(null);
      setRefSolFile(null);
      setRefSolMode("text");
      await loadAssignments();
    } else {
      const err = await res.json().catch(() => ({}));
      const detail = (err as { detail?: unknown }).detail;
      setCreateAssignmentError(
        typeof detail === "string" ? detail
        : Array.isArray(detail) ? detail.map((d: { msg?: string }) => d.msg ?? "").join("; ")
        : "Ошибка создания задания"
      );
    }
    setCreateAssignmentLoading(false);
  }

  async function handleDeleteAssignment(id: number, title: string) {
    if (!confirm(`Удалить задание "${title}"?`)) return;
    await fetch(`${BASE_URL}/admin/assignments/${id}`, { method: "DELETE", headers: adminHeaders() });
    await loadAssignments();
  }

  const btnBase: React.CSSProperties = { height: "38px", padding: "0 18px", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer", border: "none" };
  const inputStyle: React.CSSProperties = { height: "38px", padding: "0 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", outline: "none" };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f5f6fa", fontFamily: "Inter, sans-serif" }}>

      {/* Header */}
      <div style={{ backgroundColor: "white", borderBottom: "1px solid #e5e7eb", padding: "0 40px", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "36px", height: "36px", backgroundColor: "#142175", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>🛡</div>
          <span style={{ fontSize: "18px", fontWeight: 700, color: "#111" }}>Autochecker Admin</span>
        </div>
        <button onClick={() => { localStorage.removeItem("admin_logged_in"); router.push("/admin/login"); }}
          style={{ ...btnBase, backgroundColor: "#fef2f2", color: "#e53e3e" }}>
          Выйти
        </button>
      </div>

      <div style={{ padding: "32px 40px" }}>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "24px", backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "4px", width: "fit-content" }}>
          {([["users", "👤 Пользователи"], ["assignments", "📋 Задания"], ["submissions", "📨 Сдачи"], ["classes", "🏫 Классы"]] as [Tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ ...btnBase, backgroundColor: tab === key ? "#142175" : "transparent", color: tab === key ? "white" : "#555", border: "none" }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── USERS ── */}
        {tab === "users" && (
          <div style={{ backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: 0 }}>Пользователи ({users.length})</h2>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={loadUsers} style={{ ...btnBase, backgroundColor: "#f3f4f6", color: "#374151" }}>↻ Обновить</button>
                <button onClick={() => setShowCreateUser(true)} style={{ ...btnBase, backgroundColor: "#142175", color: "white" }}>+ Добавить</button>
              </div>
            </div>

            {showCreateUser && (
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #e5e7eb", backgroundColor: "#f9fafb" }}>
                <h3 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 16px", color: "#111" }}>Новый пользователь</h3>
                <form onSubmit={handleCreateUser} style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end" }}>
                  {[{ key: "full_name", placeholder: "Полное имя", type: "text" }, { key: "email", placeholder: "Email", type: "email" }, { key: "password", placeholder: "Пароль", type: "password" }]
                    .map(({ key, placeholder, type }) => (
                      <input key={key} type={type} placeholder={placeholder} required
                        value={(newUser as Record<string, string>)[key]}
                        onChange={(e) => setNewUser((p) => ({ ...p, [key]: e.target.value }))}
                        style={{ ...inputStyle, minWidth: "180px" }} />
                    ))}
                  <select value={newUser.role} onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value as "teacher" | "student" }))} style={{ ...inputStyle }}>
                    <option value="student">Студент</option>
                    <option value="teacher">Учитель</option>
                  </select>
                  <button type="submit" disabled={createUserLoading} style={{ ...btnBase, backgroundColor: "#142175", color: "white", opacity: createUserLoading ? 0.6 : 1 }}>
                    {createUserLoading ? "Создаём..." : "Создать"}
                  </button>
                  <button type="button" onClick={() => { setShowCreateUser(false); setCreateUserError(""); }} style={{ ...btnBase, backgroundColor: "#f3f4f6", color: "#374151" }}>Отмена</button>
                </form>
                {createUserError && <p style={{ color: "#e53e3e", fontSize: "13px", margin: "8px 0 0" }}>{createUserError}</p>}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "40px 2fr 2fr 120px 150px 190px", padding: "10px 24px", backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
              {["", "Имя / Email", "Telegram ID", "Роль", "Дата", ""].map((h, i) => (
                <span key={i} style={{ fontSize: "12px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.4px" }}>{h}</span>
              ))}
            </div>

            {usersLoading ? (
              <div style={{ padding: "48px", textAlign: "center", color: "#9ca3af" }}>Загрузка...</div>
            ) : users.length === 0 ? (
              <div style={{ padding: "48px", textAlign: "center", color: "#9ca3af" }}>Пользователей нет</div>
            ) : users.map((u, i) => {
              const roleInfo = ROLE_LABELS[u.role] ?? ROLE_LABELS.student;
              const isEditing = editingUserId === u.id;
              return (
                <div key={u.id} style={{ borderBottom: i < users.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "40px 2fr 2fr 120px 150px 190px", padding: "12px 24px", alignItems: "center" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fafafa")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length], display: "flex", alignItems: "center", justifyContent: "center" }}>
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
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button onClick={() => { setEditingUserId(isEditing ? null : u.id); setEditForm({ email: u.email, password: "" }); setEditUserError(""); }}
                        style={{ ...btnBase, height: "30px", padding: "0 10px", backgroundColor: isEditing ? "#142175" : "#eff6ff", color: isEditing ? "white" : "#1d4ed8", fontSize: "12px" }}>
                        {isEditing ? "Закрыть" : "✏️ Изменить"}
                      </button>
                      {u.role !== "admin" && (
                        <button onClick={() => handleDeleteUser(u.id, u.email)} style={{ ...btnBase, height: "30px", padding: "0 10px", backgroundColor: "#fee2e2", color: "#b91c1c", fontSize: "12px" }}>Удалить</button>
                      )}
                    </div>
                  </div>
                  {isEditing && (
                    <div style={{ padding: "16px 24px 20px", backgroundColor: "#f8fafc", borderTop: "1px solid #e5e7eb" }}>
                      <form onSubmit={handleEditUser} style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <label style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Email</label>
                          <input type="email" value={editForm.email} onChange={(e) => setEditForm(p => ({ ...p, email: e.target.value }))}
                            style={{ ...inputStyle, minWidth: "220px" }} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <label style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Новый пароль</label>
                          <input type="password" placeholder="Оставьте пустым, чтобы не менять" value={editForm.password} onChange={(e) => setEditForm(p => ({ ...p, password: e.target.value }))}
                            style={{ ...inputStyle, minWidth: "260px" }} />
                        </div>
                        <button type="submit" disabled={editUserLoading} style={{ ...btnBase, backgroundColor: "#142175", color: "white", opacity: editUserLoading ? 0.6 : 1 }}>
                          {editUserLoading ? "Сохраняем..." : "Сохранить"}
                        </button>
                      </form>
                      {editUserError && <p style={{ color: "#e53e3e", fontSize: "13px", margin: "8px 0 0" }}>{editUserError}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── ASSIGNMENTS ── */}
        {tab === "assignments" && (
          <div style={{ backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: 0 }}>Задания ({assignments.length})</h2>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={loadAssignments} style={{ ...btnBase, backgroundColor: "#f3f4f6", color: "#374151" }}>↻ Обновить</button>
                <button onClick={() => setShowCreateAssignment(true)} style={{ ...btnBase, backgroundColor: "#142175", color: "white" }}>+ Добавить</button>
              </div>
            </div>

            {showCreateAssignment && (
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #e5e7eb", backgroundColor: "#f9fafb" }}>
                <h3 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 14px", color: "#111" }}>Новое задание</h3>

                {/* Mode toggle */}
                <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                  {(["text", "file"] as const).map((m) => (
                    <button key={m} onClick={() => setAssignMode(m)} style={{ ...btnBase, height: "34px", backgroundColor: assignMode === m ? "#142175" : "#f3f4f6", color: assignMode === m ? "white" : "#374151" }}>
                      {m === "text" ? "✏️ Текстом" : "📎 Файл (.txt .md .pdf .docx)"}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleCreateAssignment} style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "680px" }}>
                  <input type="text" placeholder="Название задания" required value={newAssignment.title}
                    onChange={(e) => setNewAssignment((p) => ({ ...p, title: e.target.value }))}
                    style={{ ...inputStyle, height: "40px", width: "100%" }} />

                  <select value={newAssignment.class_id}
                    onChange={(e) => setNewAssignment((p) => ({ ...p, class_id: e.target.value }))}
                    style={{ ...inputStyle, height: "40px", width: "100%", color: newAssignment.class_id ? "#111" : "#6b7280" }}>
                    <option value="">— Без класса (видно всем студентам) —</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>

                  {assignMode === "text" ? (
                    <textarea placeholder="Описание задания..." required rows={5} value={newAssignment.description_text}
                      onChange={(e) => setNewAssignment((p) => ({ ...p, description_text: e.target.value }))}
                      style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", outline: "none", resize: "vertical", fontFamily: "inherit" }} />
                  ) : (
                    <div onClick={() => fileInputRef.current?.click()}
                      style={{ border: "2px dashed #d1d5db", borderRadius: "8px", padding: "20px", textAlign: "center", cursor: "pointer", backgroundColor: "white" }}>
                      <input ref={fileInputRef} type="file" accept=".txt,.md,.pdf,.docx" style={{ display: "none" }} onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
                      {uploadFile
                        ? <p style={{ margin: 0, fontSize: "14px", color: "#111" }}>📄 {uploadFile.name}</p>
                        : <p style={{ margin: 0, fontSize: "14px", color: "#6b7280" }}>Нажмите чтобы выбрать файл (.txt .md .pdf .docx)</p>}
                    </div>
                  )}

                  {/* Reference solution — optional, always visible */}
                  <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "14px" }}>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "#374151", margin: "0 0 8px" }}>
                      ✅ Эталонное решение
                      <span style={{ fontWeight: 400, color: "#9ca3af", marginLeft: "6px" }}>необязательно — LLM будет сравнивать с ним код студента</span>
                    </p>
                    <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
                      {(["text", "file"] as const).map((m) => (
                        <button key={m} type="button" onClick={() => setRefSolMode(m)}
                          style={{ ...btnBase, height: "28px", padding: "0 12px", fontSize: "12px", backgroundColor: refSolMode === m ? "#142175" : "#f3f4f6", color: refSolMode === m ? "white" : "#374151" }}>
                          {m === "text" ? "✏️ Вставить код" : "📎 Загрузить файл"}
                        </button>
                      ))}
                    </div>
                    {refSolMode === "text" ? (
                      <textarea
                        placeholder="Вставьте правильный код или описание правильного решения..."
                        rows={5}
                        value={newAssignment.reference_solution}
                        onChange={(e) => setNewAssignment((p) => ({ ...p, reference_solution: e.target.value }))}
                        style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "13px", outline: "none", resize: "vertical", fontFamily: "monospace", width: "100%", boxSizing: "border-box" }}
                      />
                    ) : (
                      <div onClick={() => refSolFileRef.current?.click()}
                        style={{ border: "2px dashed #d1d5db", borderRadius: "8px", padding: "14px", textAlign: "center", cursor: "pointer", backgroundColor: "white" }}>
                        <input ref={refSolFileRef} type="file" accept=".txt,.md,.pdf,.docx,.py,.js,.ts,.java,.cpp,.c" style={{ display: "none" }}
                          onChange={(e) => setRefSolFile(e.target.files?.[0] ?? null)} />
                        {refSolFile
                          ? <p style={{ margin: 0, fontSize: "13px", color: "#111" }}>📄 {refSolFile.name}</p>
                          : <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>Нажмите чтобы выбрать файл (.txt .md .pdf .docx .py .js ...)</p>}
                      </div>
                    )}
                  </div>

                  {createAssignmentError && <p style={{ color: "#e53e3e", fontSize: "13px", margin: 0 }}>{createAssignmentError}</p>}

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button type="submit" disabled={createAssignmentLoading} style={{ ...btnBase, backgroundColor: "#142175", color: "white", opacity: createAssignmentLoading ? 0.6 : 1 }}>
                      {createAssignmentLoading ? "Создаём..." : "Создать задание"}
                    </button>
                    <button type="button" onClick={() => { setShowCreateAssignment(false); setCreateAssignmentError(""); setNewAssignment({ title: "", description_text: "", reference_solution: "", class_id: "" }); }} style={{ ...btnBase, backgroundColor: "#f3f4f6", color: "#374151" }}>Отмена</button>
                  </div>
                </form>
              </div>
            )}

            {/* Assignment rows */}
            {assignmentsLoading ? (
              <div style={{ padding: "48px", textAlign: "center", color: "#9ca3af" }}>Загрузка...</div>
            ) : assignments.length === 0 ? (
              <div style={{ padding: "48px", textAlign: "center", color: "#9ca3af" }}>Заданий нет.</div>
            ) : assignments.map((a, i) => {
              const spec = SPEC_LABELS[a.spec_status] ?? SPEC_LABELS.pending;
              const isExpanded = expandedSpec === a.id;
              const checks = a.llm_spec?.checks ?? [];
              return (
                <div key={a.id} style={{ borderBottom: i < assignments.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", padding: "14px 24px", gap: "16px" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fafafa")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                    <span style={{ fontSize: "13px", color: "#9ca3af", fontFamily: "monospace", flexShrink: 0 }}>#{a.id}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: "0 0 3px", fontSize: "15px", fontWeight: 600, color: "#111" }}>{a.title}</p>
                      {a.description_text && (
                        <p style={{ margin: 0, fontSize: "12px", color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "460px" }}>
                          {a.description_text.slice(0, 120)}...
                        </p>
                      )}
                    </div>
                    <span style={{ display: "inline-flex", alignItems: "center", height: "26px", padding: "0 10px", borderRadius: "13px", fontSize: "12px", fontWeight: 600, backgroundColor: spec.bg, color: spec.color, whiteSpace: "nowrap" }}>
                      {spec.label}
                    </span>
                    <span style={{ fontSize: "13px", color: "#6b7280", flexShrink: 0 }}>{a.created_at.slice(0, 10)}</span>
                    {a.llm_spec && (
                      <button onClick={() => setExpandedSpec(isExpanded ? null : a.id)}
                        style={{ ...btnBase, height: "30px", padding: "0 12px", backgroundColor: isExpanded ? "#142175" : "#eff6ff", color: isExpanded ? "white" : "#1d4ed8", fontSize: "12px" }}>
                        {isExpanded ? "Скрыть spec" : "Spec"}
                      </button>
                    )}
                    <button onClick={() => handleDeleteAssignment(a.id, a.title)}
                      style={{ ...btnBase, height: "30px", padding: "0 12px", backgroundColor: "#fee2e2", color: "#b91c1c", fontSize: "12px" }}>
                      Удалить
                    </button>
                  </div>

                  {isExpanded && a.llm_spec && (
                    <div style={{ padding: "14px 24px 18px", backgroundColor: "#f8fafc", borderTop: "1px solid #e5e7eb" }}>
                      <p style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 10px" }}>
                        Критерии проверки (сгенерировано LLM)
                      </p>
                      {checks.length > 0
                        ? checks.map((c, ci) => (
                            <div key={ci} style={{ display: "flex", gap: "12px", padding: "7px 0", borderBottom: ci < checks.length - 1 ? "1px solid #e5e7eb" : "none" }}>
                              <span style={{ fontSize: "12px", fontWeight: 700, color: "#142175", flexShrink: 0, minWidth: "32px" }}>{Math.round(c.weight * 100)}%</span>
                              <div>
                                <p style={{ margin: "0 0 2px", fontSize: "13px", fontWeight: 600, color: "#111" }}>{c.id}</p>
                                <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>{c.description}</p>
                              </div>
                            </div>
                          ))
                        : <pre style={{ fontSize: "12px", color: "#6b7280", overflow: "auto", maxHeight: "300px", margin: 0 }}>{JSON.stringify(a.llm_spec, null, 2)}</pre>
                      }
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── CLASSES ── */}
        {tab === "classes" && <AdminClasses users={users} />}

        {/* ── SUBMISSIONS ── */}
        {tab === "submissions" && (
          <div style={{ backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: 0 }}>Все сдачи ({submissions.length})</h2>
              <button onClick={loadSubmissions} style={{ ...btnBase, backgroundColor: "#f3f4f6", color: "#374151" }}>↻ Обновить</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "60px 80px 80px 200px 120px 100px 80px", padding: "10px 24px", backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
              {["#", "Задание", "Студент", "Репозиторий", "Статус", "Оценка", "Дата"].map((h, i) => (
                <span key={i} style={{ fontSize: "12px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.4px" }}>{h}</span>
              ))}
            </div>

            {subsLoading ? (
              <div style={{ padding: "48px", textAlign: "center", color: "#9ca3af" }}>Загрузка...</div>
            ) : submissions.length === 0 ? (
              <div style={{ padding: "48px", textAlign: "center", color: "#9ca3af" }}>Сдач пока нет.</div>
            ) : submissions.map((s, i) => {
              const st = SUB_STATUS[s.status] ?? SUB_STATUS.pending;
              const scoreStr = s.score != null ? `${Math.round(s.score * 100)}%` : "—";
              const pfColor = s.pass_fail === "pass" ? "#15803d" : s.pass_fail === "fail" ? "#b91c1c" : "#6b7280";
              return (
                <div key={s.id} style={{ display: "grid", gridTemplateColumns: "60px 80px 80px 200px 120px 100px 80px", padding: "12px 24px", alignItems: "center", borderBottom: i < submissions.length - 1 ? "1px solid #f3f4f6" : "none" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fafafa")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                  <span style={{ fontSize: "13px", color: "#9ca3af", fontFamily: "monospace" }}>#{s.id}</span>
                  <span style={{ fontSize: "13px", color: "#374151" }}>#{s.assignment_id}</span>
                  <span style={{ fontSize: "13px", color: "#374151" }}>#{s.student_id}</span>
                  <a href={s.repo_url} target="_blank" rel="noreferrer"
                    style={{ fontSize: "12px", color: "#142175", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.repo_url.replace("https://github.com/", "")}
                  </a>
                  <span style={{ display: "inline-flex", alignItems: "center", height: "22px", padding: "0 8px", borderRadius: "11px", fontSize: "11px", fontWeight: 600, backgroundColor: st.bg, color: st.color }}>
                    {st.label}
                  </span>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: pfColor }}>
                    {scoreStr} {s.pass_fail ? (s.pass_fail === "pass" ? "✓" : "✗") : ""}
                  </span>
                  <span style={{ fontSize: "12px", color: "#9ca3af" }}>{s.created_at.slice(0, 10)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
