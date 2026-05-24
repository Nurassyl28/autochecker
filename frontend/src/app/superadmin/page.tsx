"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ────────────────────────────────────────────────────────────────────

interface University {
  id: number; name: string; slug: string; created_at: string;
  admin_count: number; teacher_count: number; student_count: number;
}
interface UniUser {
  id: number; email: string; full_name: string | null;
  role: string; tg_id: number | null; created_at: string;
}
interface UniClass {
  id: number; name: string; created_at: string;
  teacher_name: string | null; teacher_email: string | null; student_count: number;
}
interface UniAssignment {
  id: number; title: string; description_text: string | null;
  spec_status: string; class_id: number | null; created_at: string;
}

type ManageTab = "users" | "classes" | "assignments";

// ── Styles ───────────────────────────────────────────────────────────────────

const btn = (bg: string, color = "white"): React.CSSProperties => ({
  height: "36px", padding: "0 16px", borderRadius: "8px", fontSize: "13px",
  fontWeight: 600, cursor: "pointer", border: "none", backgroundColor: bg, color,
});
const inp: React.CSSProperties = {
  height: "38px", padding: "0 12px", border: "1px solid #2d2d4e",
  borderRadius: "8px", fontSize: "14px", outline: "none",
  backgroundColor: "#0f0f1a", color: "white",
};
const ROLE_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  admin:   { bg: "#ede9fe", color: "#6d28d9", label: "Админ" },
  teacher: { bg: "#dbeafe", color: "#1d4ed8", label: "Учитель" },
  student: { bg: "#dcfce7", color: "#15803d", label: "Студент" },
};
const SPEC_LABEL: Record<string, string> = {
  pending: "⏳", generating: "🔄", ready: "✅", failed: "❌",
};

function saFetch(key: string, path: string, opts: RequestInit = {}) {
  return fetch(`${BASE_URL}/superadmin${path}`, {
    ...opts,
    headers: { "X-Superadmin-Key": key, "Content-Type": "application/json", ...(opts.headers ?? {}) },
  });
}

// ── University management panel ───────────────────────────────────────────────

function UniversityPanel({ uni, saKey, onBack }: { uni: University; saKey: string; onBack: () => void }) {
  const [tab, setTab] = useState<ManageTab>("users");

  // Users
  const [users, setUsers] = useState<UniUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({ email: "", password: "", full_name: "", role: "student" });
  const [createUserLoading, setCreateUserLoading] = useState(false);
  const [createUserError, setCreateUserError] = useState("");
  const [editingUser, setEditingUser] = useState<number | null>(null);
  const [editUserForm, setEditUserForm] = useState({ email: "", password: "" });
  const [editUserLoading, setEditUserLoading] = useState(false);
  const [editUserError, setEditUserError] = useState("");

  // Classes
  const [classes, setClasses] = useState<UniClass[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [createClassForm, setCreateClassForm] = useState({ name: "", teacher_id: "" });
  const [createClassLoading, setCreateClassLoading] = useState(false);
  const [createClassError, setCreateClassError] = useState("");

  // Assignments
  const [assignments, setAssignments] = useState<UniAssignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [createAssignmentForm, setCreateAssignmentForm] = useState({ title: "", description_text: "", class_id: "" });
  const [createAssignmentLoading, setCreateAssignmentLoading] = useState(false);
  const [createAssignmentError, setCreateAssignmentError] = useState("");

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    const r = await saFetch(saKey, `/universities/${uni.id}/users`);
    if (r.ok) setUsers(await r.json());
    setUsersLoading(false);
  }, [saKey, uni.id]);

  const loadClasses = useCallback(async () => {
    setClassesLoading(true);
    const r = await saFetch(saKey, `/universities/${uni.id}/classes`);
    if (r.ok) setClasses(await r.json());
    setClassesLoading(false);
  }, [saKey, uni.id]);

  const loadAssignments = useCallback(async () => {
    setAssignmentsLoading(true);
    const r = await saFetch(saKey, `/universities/${uni.id}/assignments`);
    if (r.ok) setAssignments(await r.json());
    setAssignmentsLoading(false);
  }, [saKey, uni.id]);

  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => { if (tab === "classes") loadClasses(); }, [tab, loadClasses]);
  useEffect(() => { if (tab === "assignments") loadAssignments(); }, [tab, loadAssignments]);

  const teachers = users.filter(u => u.role === "teacher");

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateUserLoading(true); setCreateUserError("");
    const r = await saFetch(saKey, `/universities/${uni.id}/users`, { method: "POST", body: JSON.stringify(createUserForm) });
    if (r.ok) { setShowCreateUser(false); setCreateUserForm({ email: "", password: "", full_name: "", role: "student" }); await loadUsers(); }
    else { const d = await r.json().catch(() => ({})); setCreateUserError((d as {detail?:string}).detail || "Ошибка"); }
    setCreateUserLoading(false);
  }

  async function handleDeleteUser(id: number) {
    if (!confirm("Удалить пользователя?")) return;
    await saFetch(saKey, `/universities/${uni.id}/users/${id}`, { method: "DELETE" });
    await loadUsers();
  }

  async function handleEditUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setEditUserLoading(true); setEditUserError("");
    const body: Record<string, string> = {};
    if (editUserForm.email.trim()) body.email = editUserForm.email.trim();
    if (editUserForm.password.trim()) body.password = editUserForm.password.trim();
    const r = await saFetch(saKey, `/universities/${uni.id}/users/${editingUser}`, { method: "PATCH", body: JSON.stringify(body) });
    if (r.ok) { setEditingUser(null); await loadUsers(); }
    else { const d = await r.json().catch(() => ({})); setEditUserError((d as {detail?:string}).detail || "Ошибка"); }
    setEditUserLoading(false);
  }

  async function handleCreateClass(e: React.FormEvent) {
    e.preventDefault();
    setCreateClassLoading(true); setCreateClassError("");
    const body = { name: createClassForm.name, teacher_id: createClassForm.teacher_id ? Number(createClassForm.teacher_id) : null };
    const r = await saFetch(saKey, `/universities/${uni.id}/classes`, { method: "POST", body: JSON.stringify(body) });
    if (r.ok) { setShowCreateClass(false); setCreateClassForm({ name: "", teacher_id: "" }); await loadClasses(); }
    else { const d = await r.json().catch(() => ({})); setCreateClassError((d as {detail?:string}).detail || "Ошибка"); }
    setCreateClassLoading(false);
  }

  async function handleDeleteClass(id: number) {
    if (!confirm("Удалить класс?")) return;
    await saFetch(saKey, `/universities/${uni.id}/classes/${id}`, { method: "DELETE" });
    await loadClasses();
  }

  async function handleCreateAssignment(e: React.FormEvent) {
    e.preventDefault();
    setCreateAssignmentLoading(true); setCreateAssignmentError("");
    const body = { title: createAssignmentForm.title, description_text: createAssignmentForm.description_text, class_id: createAssignmentForm.class_id ? Number(createAssignmentForm.class_id) : null };
    const r = await saFetch(saKey, `/universities/${uni.id}/assignments`, { method: "POST", body: JSON.stringify(body) });
    if (r.ok) { setShowCreateAssignment(false); setCreateAssignmentForm({ title: "", description_text: "", class_id: "" }); await loadAssignments(); }
    else { const d = await r.json().catch(() => ({})); setCreateAssignmentError((d as {detail?:string}).detail || "Ошибка"); }
    setCreateAssignmentLoading(false);
  }

  async function handleDeleteAssignment(id: number) {
    if (!confirm("Удалить задание?")) return;
    await saFetch(saKey, `/universities/${uni.id}/assignments/${id}`, { method: "DELETE" });
    await loadAssignments();
  }

  const panelBg = "#1a1a2e";
  const borderColor = "#2d2d4e";

  return (
    <div>
      {/* Back + title */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px" }}>
        <button onClick={onBack} style={btn("#2d1f4e", "#c4b5fd")}>← Назад</button>
        <div>
          <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 700 }}>{uni.name}</h2>
          <p style={{ margin: 0, fontSize: "13px", color: "#6d6d90" }}>slug: {uni.slug} · {uni.admin_count} адм. · {uni.teacher_count} уч. · {uni.student_count} студ.</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "20px", backgroundColor: "#13132a", border: `1px solid ${borderColor}`, borderRadius: "10px", padding: "4px", width: "fit-content" }}>
        {([["users", "👤 Пользователи"], ["classes", "🏫 Классы"], ["assignments", "📋 Задания"]] as [ManageTab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ ...btn(tab === key ? "#6d28d9" : "transparent", tab === key ? "white" : "#8b8ba0"), height: "34px" }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── USERS ── */}
      {tab === "users" && (
        <div style={{ backgroundColor: panelBg, border: `1px solid ${borderColor}`, borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${borderColor}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: "16px" }}>Пользователи ({users.length})</span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={loadUsers} style={btn("#1e1e35", "#a0a0c0")}>↻</button>
              <button onClick={() => setShowCreateUser(true)} style={btn("#6d28d9")}>+ Добавить</button>
            </div>
          </div>

          {showCreateUser && (
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${borderColor}`, backgroundColor: "#13132a" }}>
              <form onSubmit={handleCreateUser} style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end" }}>
                <input placeholder="Имя" value={createUserForm.full_name} onChange={e => setCreateUserForm(p => ({ ...p, full_name: e.target.value }))} style={{ ...inp, minWidth: "140px" }} />
                <input type="email" placeholder="Email" required value={createUserForm.email} onChange={e => setCreateUserForm(p => ({ ...p, email: e.target.value }))} style={{ ...inp, minWidth: "200px" }} />
                <input type="password" placeholder="Пароль" required value={createUserForm.password} onChange={e => setCreateUserForm(p => ({ ...p, password: e.target.value }))} style={{ ...inp, minWidth: "160px" }} />
                <select value={createUserForm.role} onChange={e => setCreateUserForm(p => ({ ...p, role: e.target.value }))} style={inp}>
                  <option value="student">Студент</option>
                  <option value="teacher">Учитель</option>
                  <option value="admin">Админ</option>
                </select>
                <button type="submit" disabled={createUserLoading} style={btn("#6d28d9")}>{createUserLoading ? "..." : "Создать"}</button>
                <button type="button" onClick={() => { setShowCreateUser(false); setCreateUserError(""); }} style={btn("#1e1e35", "#a0a0c0")}>Отмена</button>
              </form>
              {createUserError && <p style={{ color: "#f87171", fontSize: "13px", margin: "8px 0 0" }}>{createUserError}</p>}
            </div>
          )}

          {usersLoading ? <div style={{ padding: "40px", textAlign: "center", color: "#4a4a6a" }}>Загрузка...</div>
            : users.length === 0 ? <div style={{ padding: "40px", textAlign: "center", color: "#4a4a6a" }}>Пользователей нет</div>
            : users.map((u, i) => {
              const rs = ROLE_STYLE[u.role] ?? ROLE_STYLE.student;
              const isEditing = editingUser === u.id;
              return (
                <div key={u.id} style={{ borderBottom: i < users.length - 1 ? `1px solid #1e1e35` : "none" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px 180px", padding: "10px 20px", alignItems: "center", gap: "12px" }}>
                    <div>
                      <p style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: 600 }}>{u.full_name || "—"}</p>
                      <p style={{ margin: 0, fontSize: "12px", color: "#6d6d90" }}>{u.email}</p>
                    </div>
                    <span style={{ fontSize: "12px", color: "#4a4a6a" }}>{u.created_at.slice(0, 10)}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", height: "22px", padding: "0 10px", borderRadius: "11px", fontSize: "11px", fontWeight: 600, backgroundColor: rs.bg, color: rs.color }}>
                      {rs.label}
                    </span>
                    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                      <button onClick={() => { setEditingUser(isEditing ? null : u.id); setEditUserForm({ email: u.email, password: "" }); setEditUserError(""); }}
                        style={btn(isEditing ? "#4c1d95" : "#1e1e35", isEditing ? "white" : "#c4b5fd")}>✏️</button>
                      <button onClick={() => handleDeleteUser(u.id)} style={btn("#2d1f1f", "#f87171")}>✕</button>
                    </div>
                  </div>
                  {isEditing && (
                    <div style={{ padding: "12px 20px 16px", backgroundColor: "#13132a", borderTop: `1px solid ${borderColor}` }}>
                      <form onSubmit={handleEditUser} style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end" }}>
                        <input type="email" placeholder="Новый email" value={editUserForm.email} onChange={e => setEditUserForm(p => ({ ...p, email: e.target.value }))} style={{ ...inp, minWidth: "220px" }} />
                        <input type="password" placeholder="Новый пароль (необязательно)" value={editUserForm.password} onChange={e => setEditUserForm(p => ({ ...p, password: e.target.value }))} style={{ ...inp, minWidth: "240px" }} />
                        <button type="submit" disabled={editUserLoading} style={btn("#6d28d9")}>{editUserLoading ? "..." : "Сохранить"}</button>
                      </form>
                      {editUserError && <p style={{ color: "#f87171", fontSize: "13px", margin: "6px 0 0" }}>{editUserError}</p>}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* ── CLASSES ── */}
      {tab === "classes" && (
        <div style={{ backgroundColor: panelBg, border: `1px solid ${borderColor}`, borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${borderColor}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: "16px" }}>Классы ({classes.length})</span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={loadClasses} style={btn("#1e1e35", "#a0a0c0")}>↻</button>
              <button onClick={() => setShowCreateClass(true)} style={btn("#6d28d9")}>+ Создать</button>
            </div>
          </div>
          {showCreateClass && (
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${borderColor}`, backgroundColor: "#13132a" }}>
              <form onSubmit={handleCreateClass} style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end" }}>
                <input placeholder="Название класса" required value={createClassForm.name} onChange={e => setCreateClassForm(p => ({ ...p, name: e.target.value }))} style={{ ...inp, minWidth: "220px" }} />
                <select value={createClassForm.teacher_id} onChange={e => setCreateClassForm(p => ({ ...p, teacher_id: e.target.value }))} style={inp}>
                  <option value="">— Без учителя —</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name || t.email}</option>)}
                </select>
                <button type="submit" disabled={createClassLoading} style={btn("#6d28d9")}>{createClassLoading ? "..." : "Создать"}</button>
                <button type="button" onClick={() => { setShowCreateClass(false); setCreateClassError(""); }} style={btn("#1e1e35", "#a0a0c0")}>Отмена</button>
              </form>
              {createClassError && <p style={{ color: "#f87171", fontSize: "13px", margin: "8px 0 0" }}>{createClassError}</p>}
            </div>
          )}
          {classesLoading ? <div style={{ padding: "40px", textAlign: "center", color: "#4a4a6a" }}>Загрузка...</div>
            : classes.length === 0 ? <div style={{ padding: "40px", textAlign: "center", color: "#4a4a6a" }}>Классов нет</div>
            : classes.map((c, i) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", padding: "12px 20px", gap: "16px", borderBottom: i < classes.length - 1 ? `1px solid #1e1e35` : "none" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: 600 }}>{c.name}</p>
                  <p style={{ margin: 0, fontSize: "12px", color: "#6d6d90" }}>
                    {c.teacher_name ? `👨‍🏫 ${c.teacher_name}` : "Учитель не назначен"} · {c.student_count} студ.
                  </p>
                </div>
                <span style={{ fontSize: "12px", color: "#4a4a6a" }}>{c.created_at.slice(0, 10)}</span>
                <button onClick={() => handleDeleteClass(c.id)} style={btn("#2d1f1f", "#f87171")}>Удалить</button>
              </div>
            ))}
        </div>
      )}

      {/* ── ASSIGNMENTS ── */}
      {tab === "assignments" && (
        <div style={{ backgroundColor: panelBg, border: `1px solid ${borderColor}`, borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${borderColor}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: "16px" }}>Задания ({assignments.length})</span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={loadAssignments} style={btn("#1e1e35", "#a0a0c0")}>↻</button>
              <button onClick={() => setShowCreateAssignment(true)} style={btn("#6d28d9")}>+ Создать</button>
            </div>
          </div>
          {showCreateAssignment && (
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${borderColor}`, backgroundColor: "#13132a" }}>
              <form onSubmit={handleCreateAssignment} style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "600px" }}>
                <input placeholder="Название задания" required value={createAssignmentForm.title} onChange={e => setCreateAssignmentForm(p => ({ ...p, title: e.target.value }))} style={{ ...inp, width: "100%" }} />
                <select value={createAssignmentForm.class_id} onChange={e => setCreateAssignmentForm(p => ({ ...p, class_id: e.target.value }))} style={{ ...inp, width: "100%", color: createAssignmentForm.class_id ? "white" : "#6d6d90" }}>
                  <option value="">— Без класса (для всех студентов) —</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <textarea placeholder="Описание задания..." required rows={4} value={createAssignmentForm.description_text}
                  onChange={e => setCreateAssignmentForm(p => ({ ...p, description_text: e.target.value }))}
                  style={{ padding: "10px 12px", border: "1px solid #2d2d4e", borderRadius: "8px", fontSize: "14px", outline: "none", resize: "vertical", fontFamily: "inherit", backgroundColor: "#0f0f1a", color: "white" }} />
                {createAssignmentError && <p style={{ color: "#f87171", fontSize: "13px", margin: 0 }}>{createAssignmentError}</p>}
                <div style={{ display: "flex", gap: "8px" }}>
                  <button type="submit" disabled={createAssignmentLoading} style={btn("#6d28d9")}>{createAssignmentLoading ? "Создаём..." : "Создать задание"}</button>
                  <button type="button" onClick={() => { setShowCreateAssignment(false); setCreateAssignmentError(""); }} style={btn("#1e1e35", "#a0a0c0")}>Отмена</button>
                </div>
              </form>
            </div>
          )}
          {assignmentsLoading ? <div style={{ padding: "40px", textAlign: "center", color: "#4a4a6a" }}>Загрузка...</div>
            : assignments.length === 0 ? <div style={{ padding: "40px", textAlign: "center", color: "#4a4a6a" }}>Заданий нет</div>
            : assignments.map((a, i) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", padding: "12px 20px", gap: "16px", borderBottom: i < assignments.length - 1 ? `1px solid #1e1e35` : "none" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: 600 }}>{a.title}</p>
                  <p style={{ margin: 0, fontSize: "12px", color: "#6d6d90", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "500px" }}>
                    {a.description_text?.slice(0, 100)}
                  </p>
                </div>
                <span style={{ fontSize: "16px" }} title={a.spec_status}>{SPEC_LABEL[a.spec_status] ?? "?"}</span>
                <span style={{ fontSize: "12px", color: "#4a4a6a" }}>{a.created_at.slice(0, 10)}</span>
                <button onClick={() => handleDeleteAssignment(a.id)} style={btn("#2d1f1f", "#f87171")}>Удалить</button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ── Main super-admin page ─────────────────────────────────────────────────────

export default function SuperAdminPage() {
  const router = useRouter();
  const [saKey, setSaKey] = useState("");
  const [universities, setUniversities] = useState<University[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUni, setSelectedUni] = useState<University | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [form, setForm] = useState({ name: "", slug: "", admin_email: "", admin_password: "", admin_full_name: "" });

  useEffect(() => {
    const k = localStorage.getItem("superadmin_key");
    if (!k) { router.replace("/superadmin/login"); return; }
    setSaKey(k);
  }, [router]);

  const loadUniversities = useCallback(async (key: string) => {
    setLoading(true);
    const r = await saFetch(key, "/universities");
    if (r.status === 401) { localStorage.removeItem("superadmin_key"); router.replace("/superadmin/login"); return; }
    if (r.ok) setUniversities(await r.json());
    setLoading(false);
  }, [router]);

  useEffect(() => { if (saKey) loadUniversities(saKey); }, [saKey, loadUniversities]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateLoading(true); setCreateError("");
    const r = await saFetch(saKey, "/universities", { method: "POST", body: JSON.stringify(form) });
    if (r.ok) {
      setShowCreate(false);
      setForm({ name: "", slug: "", admin_email: "", admin_password: "", admin_full_name: "" });
      await loadUniversities(saKey);
    } else {
      const d = await r.json().catch(() => ({}));
      setCreateError((d as { detail?: string }).detail || "Ошибка создания");
    }
    setCreateLoading(false);
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Удалить университет "${name}" и ВСЕ его данные? Необратимо.`)) return;
    await saFetch(saKey, `/universities/${id}`, { method: "DELETE" });
    if (selectedUni?.id === id) setSelectedUni(null);
    await loadUniversities(saKey);
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0f0f1a", fontFamily: "Inter, sans-serif", color: "white" }}>
      {/* Header */}
      <div style={{ backgroundColor: "#1a1a2e", borderBottom: "1px solid #2d2d4e", padding: "0 40px", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "36px", height: "36px", backgroundColor: "#6d28d9", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>🔑</div>
          <div>
            <span style={{ fontSize: "18px", fontWeight: 700 }}>Super Admin</span>
            {selectedUni && <span style={{ fontSize: "14px", color: "#8b8ba0", marginLeft: "10px" }}>→ {selectedUni.name}</span>}
          </div>
        </div>
        <button onClick={() => { localStorage.removeItem("superadmin_key"); router.push("/superadmin/login"); }}
          style={btn("#2d1f1f", "#f87171")}>Выйти</button>
      </div>

      <div style={{ padding: "32px 40px" }}>
        {selectedUni ? (
          <UniversityPanel
            uni={selectedUni}
            saKey={saKey}
            onBack={() => { setSelectedUni(null); loadUniversities(saKey); }}
          />
        ) : (
          <>
            {/* Actions bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 700 }}>Университеты ({universities.length})</h2>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => loadUniversities(saKey)} style={btn("#1e1e35", "#a0a0c0")}>↻ Обновить</button>
                <button onClick={() => setShowCreate(true)} style={btn("#6d28d9")}>+ Создать университет</button>
              </div>
            </div>

            {/* Create form */}
            {showCreate && (
              <div style={{ backgroundColor: "#1a1a2e", border: "1px solid #2d2d4e", borderRadius: "12px", padding: "24px", marginBottom: "20px" }}>
                <h3 style={{ margin: "0 0 18px", fontSize: "16px", fontWeight: 700, color: "#c4b5fd" }}>Новый университет</h3>
                <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "640px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <input placeholder="Название (напр. AITU)" required value={form.name}
                      onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={inp} />
                    <input placeholder="Slug (напр. aitu)" required value={form.slug}
                      onChange={e => setForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))} style={inp} />
                  </div>
                  <p style={{ margin: 0, fontSize: "12px", color: "#6d6d90" }}>Первый администратор университета:</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                    <input placeholder="Имя" value={form.admin_full_name}
                      onChange={e => setForm(p => ({ ...p, admin_full_name: e.target.value }))} style={inp} />
                    <input type="email" placeholder="Email" required value={form.admin_email}
                      onChange={e => setForm(p => ({ ...p, admin_email: e.target.value }))} style={inp} />
                    <input type="password" placeholder="Пароль" required value={form.admin_password}
                      onChange={e => setForm(p => ({ ...p, admin_password: e.target.value }))} style={inp} />
                  </div>
                  {createError && <p style={{ color: "#f87171", fontSize: "13px", margin: 0 }}>{createError}</p>}
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button type="submit" disabled={createLoading} style={btn("#6d28d9")}>{createLoading ? "Создаём..." : "Создать"}</button>
                    <button type="button" onClick={() => { setShowCreate(false); setCreateError(""); }} style={btn("#1e1e35", "#a0a0c0")}>Отмена</button>
                  </div>
                </form>
              </div>
            )}

            {/* Universities list */}
            <div style={{ backgroundColor: "#1a1a2e", border: "1px solid #2d2d4e", borderRadius: "12px", overflow: "hidden" }}>
              {loading ? (
                <div style={{ padding: "48px", textAlign: "center", color: "#4a4a6a" }}>Загрузка...</div>
              ) : universities.length === 0 ? (
                <div style={{ padding: "48px", textAlign: "center", color: "#4a4a6a" }}>Университетов нет. Создайте первый!</div>
              ) : universities.map((uni, i) => (
                <div key={uni.id} style={{ display: "flex", alignItems: "center", padding: "16px 24px", gap: "16px", borderBottom: i < universities.length - 1 ? "1px solid #2d2d4e" : "none" }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 700 }}>{uni.name}</p>
                    <p style={{ margin: 0, fontSize: "12px", color: "#6d6d90" }}>
                      <span style={{ fontFamily: "monospace", color: "#a0a0c0" }}>{uni.slug}</span>
                      {" · "}
                      <span style={{ color: "#c4b5fd" }}>{uni.admin_count} адм.</span>
                      {" · "}
                      <span style={{ color: "#93c5fd" }}>{uni.teacher_count} уч.</span>
                      {" · "}
                      <span style={{ color: "#86efac" }}>{uni.student_count} студ.</span>
                    </p>
                  </div>
                  <span style={{ fontSize: "12px", color: "#4a4a6a" }}>{uni.created_at.slice(0, 10)}</span>
                  <button onClick={() => setSelectedUni(uni)} style={btn("#4c1d95", "white")}>Управление →</button>
                  <button onClick={() => handleDelete(uni.id, uni.name)} style={btn("#2d1f1f", "#f87171")}>Удалить</button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
