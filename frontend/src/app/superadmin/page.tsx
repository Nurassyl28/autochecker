"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface University {
  id: number;
  name: string;
  slug: string;
  created_at: string;
  admin_count: number;
  teacher_count: number;
  student_count: number;
}

interface UniUser {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
}

function saHeaders(key: string): HeadersInit {
  return { "X-Superadmin-Key": key, "Content-Type": "application/json" };
}

const btnBase: React.CSSProperties = { height: "38px", padding: "0 18px", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer", border: "none" };
const inputStyle: React.CSSProperties = { height: "38px", padding: "0 12px", border: "1px solid #2d2d4e", borderRadius: "8px", fontSize: "14px", outline: "none", backgroundColor: "#0f0f1a", color: "white" };

export default function SuperAdminPage() {
  const router = useRouter();
  const [saKey, setSaKey] = useState("");
  const [universities, setUniversities] = useState<University[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [form, setForm] = useState({ name: "", slug: "", admin_email: "", admin_password: "", admin_full_name: "" });

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [uniUsers, setUniUsers] = useState<UniUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const [showAddAdmin, setShowAddAdmin] = useState<number | null>(null);
  const [addAdminForm, setAddAdminForm] = useState({ email: "", password: "", full_name: "" });
  const [addAdminLoading, setAddAdminLoading] = useState(false);
  const [addAdminError, setAddAdminError] = useState("");

  useEffect(() => {
    const k = localStorage.getItem("superadmin_key");
    if (!k) { router.replace("/superadmin/login"); return; }
    setSaKey(k);
  }, [router]);

  const loadUniversities = useCallback(async (key: string) => {
    setLoading(true);
    const res = await fetch(`${BASE_URL}/superadmin/universities`, { headers: { "X-Superadmin-Key": key } });
    if (res.status === 401) { localStorage.removeItem("superadmin_key"); router.replace("/superadmin/login"); return; }
    if (res.ok) setUniversities(await res.json());
    setLoading(false);
  }, [router]);

  useEffect(() => { if (saKey) loadUniversities(saKey); }, [saKey, loadUniversities]);

  const loadUniUsers = useCallback(async (uniId: number) => {
    setUsersLoading(true);
    const res = await fetch(`${BASE_URL}/superadmin/universities/${uniId}/users`, { headers: { "X-Superadmin-Key": saKey } });
    if (res.ok) setUniUsers(await res.json());
    setUsersLoading(false);
  }, [saKey]);

  useEffect(() => {
    if (expandedId != null) loadUniUsers(expandedId);
    else setUniUsers([]);
  }, [expandedId, loadUniUsers]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError("");
    const res = await fetch(`${BASE_URL}/superadmin/universities`, {
      method: "POST",
      headers: saHeaders(saKey),
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowCreate(false);
      setForm({ name: "", slug: "", admin_email: "", admin_password: "", admin_full_name: "" });
      await loadUniversities(saKey);
    } else {
      const err = await res.json().catch(() => ({}));
      setCreateError((err as { detail?: string }).detail || "Ошибка создания");
    }
    setCreateLoading(false);
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Удалить университет "${name}" и ВСЕ его данные? Это необратимо.`)) return;
    await fetch(`${BASE_URL}/superadmin/universities/${id}`, { method: "DELETE", headers: { "X-Superadmin-Key": saKey } });
    if (expandedId === id) setExpandedId(null);
    await loadUniversities(saKey);
  }

  async function handleAddAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!showAddAdmin) return;
    setAddAdminLoading(true);
    setAddAdminError("");
    const res = await fetch(`${BASE_URL}/superadmin/universities/${showAddAdmin}/admins`, {
      method: "POST",
      headers: saHeaders(saKey),
      body: JSON.stringify(addAdminForm),
    });
    if (res.ok) {
      setShowAddAdmin(null);
      setAddAdminForm({ email: "", password: "", full_name: "" });
      await loadUniUsers(showAddAdmin);
      await loadUniversities(saKey);
    } else {
      const err = await res.json().catch(() => ({}));
      setAddAdminError((err as { detail?: string }).detail || "Ошибка");
    }
    setAddAdminLoading(false);
  }

  const ROLE_COLORS: Record<string, string> = { admin: "#6d28d9", teacher: "#1d4ed8", student: "#15803d" };
  const ROLE_BG: Record<string, string> = { admin: "#ede9fe", teacher: "#dbeafe", student: "#dcfce7" };
  const ROLE_LABELS: Record<string, string> = { admin: "Админ", teacher: "Учитель", student: "Студент" };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0f0f1a", fontFamily: "Inter, sans-serif", color: "white" }}>

      {/* Header */}
      <div style={{ backgroundColor: "#1a1a2e", borderBottom: "1px solid #2d2d4e", padding: "0 40px", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "36px", height: "36px", backgroundColor: "#6d28d9", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>🔑</div>
          <span style={{ fontSize: "18px", fontWeight: 700 }}>Super Admin — Управление университетами</span>
        </div>
        <button onClick={() => { localStorage.removeItem("superadmin_key"); router.push("/superadmin/login"); }}
          style={{ ...btnBase, backgroundColor: "#2d1f1f", color: "#f87171" }}>
          Выйти
        </button>
      </div>

      <div style={{ padding: "32px 40px" }}>

        {/* Actions bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 700 }}>Университеты ({universities.length})</h2>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => loadUniversities(saKey)} style={{ ...btnBase, backgroundColor: "#1e1e35", color: "#a0a0c0" }}>↻ Обновить</button>
            <button onClick={() => setShowCreate(true)} style={{ ...btnBase, backgroundColor: "#6d28d9", color: "white" }}>+ Добавить университет</button>
          </div>
        </div>

        {/* Create form */}
        {showCreate && (
          <div style={{ backgroundColor: "#1a1a2e", border: "1px solid #2d2d4e", borderRadius: "12px", padding: "24px", marginBottom: "20px" }}>
            <h3 style={{ margin: "0 0 18px", fontSize: "16px", fontWeight: 700, color: "#c4b5fd" }}>Новый университет</h3>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "600px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <input type="text" placeholder="Название (напр. AITU)" required value={form.name}
                  onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
                <input type="text" placeholder="Slug (напр. aitu)" required value={form.slug}
                  onChange={(e) => setForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))} style={inputStyle} />
              </div>
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#6d6d90" }}>Данные первого администратора университета:</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                <input type="text" placeholder="Имя админа" value={form.admin_full_name}
                  onChange={(e) => setForm(p => ({ ...p, admin_full_name: e.target.value }))} style={inputStyle} />
                <input type="email" placeholder="Email админа" required value={form.admin_email}
                  onChange={(e) => setForm(p => ({ ...p, admin_email: e.target.value }))} style={inputStyle} />
                <input type="password" placeholder="Пароль админа" required value={form.admin_password}
                  onChange={(e) => setForm(p => ({ ...p, admin_password: e.target.value }))} style={inputStyle} />
              </div>
              {createError && <p style={{ color: "#f87171", fontSize: "13px", margin: 0 }}>{createError}</p>}
              <div style={{ display: "flex", gap: "8px" }}>
                <button type="submit" disabled={createLoading} style={{ ...btnBase, backgroundColor: "#6d28d9", color: "white", opacity: createLoading ? 0.6 : 1 }}>
                  {createLoading ? "Создаём..." : "Создать"}
                </button>
                <button type="button" onClick={() => { setShowCreate(false); setCreateError(""); }} style={{ ...btnBase, backgroundColor: "#1e1e35", color: "#a0a0c0" }}>Отмена</button>
              </div>
            </form>
          </div>
        )}

        {/* Universities list */}
        <div style={{ backgroundColor: "#1a1a2e", border: "1px solid #2d2d4e", borderRadius: "12px", overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#6d6d90" }}>Загрузка...</div>
          ) : universities.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#6d6d90" }}>Университетов нет. Создайте первый!</div>
          ) : universities.map((uni, i) => {
            const isExpanded = expandedId === uni.id;
            const isAddingAdmin = showAddAdmin === uni.id;
            return (
              <div key={uni.id} style={{ borderBottom: i < universities.length - 1 ? "1px solid #2d2d4e" : "none" }}>
                {/* Row */}
                <div style={{ display: "flex", alignItems: "center", padding: "16px 24px", gap: "16px" }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 700 }}>{uni.name}</p>
                    <p style={{ margin: 0, fontSize: "12px", color: "#6d6d90" }}>
                      slug: <span style={{ color: "#a0a0c0", fontFamily: "monospace" }}>{uni.slug}</span>
                      {" · "}
                      <span style={{ color: "#c4b5fd" }}>{uni.admin_count} адм.</span>
                      {" · "}
                      <span style={{ color: "#93c5fd" }}>{uni.teacher_count} уч.</span>
                      {" · "}
                      <span style={{ color: "#86efac" }}>{uni.student_count} студ.</span>
                    </p>
                  </div>
                  <span style={{ fontSize: "12px", color: "#4a4a6a", flexShrink: 0 }}>{uni.created_at.slice(0, 10)}</span>
                  <button onClick={() => { setExpandedId(isExpanded ? null : uni.id); setShowAddAdmin(null); }}
                    style={{ ...btnBase, height: "30px", padding: "0 12px", fontSize: "12px", backgroundColor: isExpanded ? "#4c1d95" : "#2d1f4e", color: isExpanded ? "white" : "#c4b5fd" }}>
                    {isExpanded ? "Скрыть" : "Пользователи"}
                  </button>
                  <button onClick={() => handleDelete(uni.id, uni.name)}
                    style={{ ...btnBase, height: "30px", padding: "0 12px", fontSize: "12px", backgroundColor: "#2d1f1f", color: "#f87171" }}>
                    Удалить
                  </button>
                </div>

                {/* Expanded users */}
                {isExpanded && (
                  <div style={{ padding: "16px 24px 20px", backgroundColor: "#13132a", borderTop: "1px solid #2d2d4e" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                      <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#8b8ba0", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Пользователи ({uniUsers.length})
                      </p>
                      <button onClick={() => setShowAddAdmin(isAddingAdmin ? null : uni.id)}
                        style={{ ...btnBase, height: "28px", padding: "0 12px", fontSize: "12px", backgroundColor: "#4c1d95", color: "white" }}>
                        {isAddingAdmin ? "Отмена" : "+ Добавить админа"}
                      </button>
                    </div>

                    {isAddingAdmin && (
                      <form onSubmit={handleAddAdmin} style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "14px", padding: "14px", backgroundColor: "#1a1a35", borderRadius: "8px" }}>
                        <input type="text" placeholder="Имя" value={addAdminForm.full_name}
                          onChange={(e) => setAddAdminForm(p => ({ ...p, full_name: e.target.value }))} style={{ ...inputStyle, minWidth: "160px" }} />
                        <input type="email" placeholder="Email" required value={addAdminForm.email}
                          onChange={(e) => setAddAdminForm(p => ({ ...p, email: e.target.value }))} style={{ ...inputStyle, minWidth: "200px" }} />
                        <input type="password" placeholder="Пароль" required value={addAdminForm.password}
                          onChange={(e) => setAddAdminForm(p => ({ ...p, password: e.target.value }))} style={{ ...inputStyle, minWidth: "160px" }} />
                        <button type="submit" disabled={addAdminLoading} style={{ ...btnBase, height: "38px", backgroundColor: "#6d28d9", color: "white", opacity: addAdminLoading ? 0.6 : 1 }}>
                          {addAdminLoading ? "..." : "Создать"}
                        </button>
                        {addAdminError && <p style={{ color: "#f87171", fontSize: "12px", margin: 0, width: "100%" }}>{addAdminError}</p>}
                      </form>
                    )}

                    {usersLoading ? (
                      <p style={{ color: "#4a4a6a", fontSize: "13px" }}>Загрузка...</p>
                    ) : uniUsers.length === 0 ? (
                      <p style={{ color: "#4a4a6a", fontSize: "13px" }}>Пользователей нет</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {uniUsers.map((u) => (
                          <div key={u.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 12px", backgroundColor: "#1a1a2e", borderRadius: "8px" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", height: "22px", padding: "0 8px", borderRadius: "11px", fontSize: "11px", fontWeight: 600, backgroundColor: ROLE_BG[u.role] ?? "#f3f4f6", color: ROLE_COLORS[u.role] ?? "#374151", flexShrink: 0 }}>
                              {ROLE_LABELS[u.role] ?? u.role}
                            </span>
                            <span style={{ fontSize: "14px", fontWeight: 600, flex: 1 }}>{u.full_name || "—"}</span>
                            <span style={{ fontSize: "13px", color: "#6d6d90" }}>{u.email}</span>
                            <span style={{ fontSize: "12px", color: "#4a4a6a" }}>{u.created_at.slice(0, 10)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
