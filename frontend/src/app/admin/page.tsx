"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getAdminUsers,
  updateAdminUser,
  deleteAdminUser,
  addAdminUser,
  type AdminUser,
} from "@/lib/store";

const STATS = [
  { label: "Всего пользователей", value: "1,284", sub: "+12% с прошлого месяца", subColor: "#3525cd", icon: "👥" },
  { label: "Преподаватели", value: "142", sub: "11% от общего числа", subColor: "#666", icon: "🎓" },
  { label: "Студенты", value: "1,142", sub: "89% от общего числа", subColor: "#666", icon: "👤" },
  { label: "Активны (24ч)", value: "892", sub: "Стабильно", subColor: "#3525cd", icon: "⚡" },
];

interface EditState {
  name: string;
  email: string;
  password: string;
  role: "teacher" | "student";
}

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [showPassword, setShowPassword] = useState<Record<number, boolean>>({});
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editState, setEditState] = useState<EditState>({ name: "", email: "", password: "", role: "student" });
  const [editShowPw, setEditShowPw] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addState, setAddState] = useState<EditState>({ name: "", email: "", password: "", role: "student" });
  const [addShowPw, setAddShowPw] = useState(false);
  const router = useRouter();

  function loadUsers() {
    setUsers(getAdminUsers());
  }

  useEffect(() => {
    if (!localStorage.getItem("admin_logged_in")) {
      router.replace("/admin/login");
      return;
    }
    loadUsers();
  }, [router]);

  function togglePassword(id: number) {
    setShowPassword((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function openEdit(user: AdminUser) {
    setEditingUser(user);
    setEditState({ name: user.name, email: user.email, password: user.password, role: user.role });
    setEditShowPw(false);
  }

  function closeEdit() {
    setEditingUser(null);
    setEditState({ name: "", email: "", password: "", role: "student" });
  }

  function handleSaveEdit() {
    if (!editingUser) return;
    updateAdminUser(editingUser.id, {
      name: editState.name.trim(),
      email: editState.email.trim(),
      password: editState.password,
      role: editState.role,
    });
    loadUsers();
    closeEdit();
  }

  function handleDelete(id: number) {
    if (!confirm("Удалить пользователя?")) return;
    deleteAdminUser(id);
    loadUsers();
  }

  const AVATAR_COLORS = ["#1565c0", "#e91e63", "#4caf50", "#9c27b0", "#ff9800", "#00897b", "#f44336", "#3f51b5"];

  function getInitials(name: string): string {
    return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  }

  function handleAddUser() {
    const { name, email, password, role } = addState;
    if (!name.trim() || !email.trim() || !password) return;
    const existing = getAdminUsers();
    const color = AVATAR_COLORS[existing.length % AVATAR_COLORS.length];
    addAdminUser({ name: name.trim(), email: email.trim(), password, role, initial: getInitials(name), avatarColor: color });
    loadUsers();
    setShowAddModal(false);
    setAddState({ name: "", email: "", password: "", role: "student" });
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", height: "48px",
    border: "1.5px solid #ddd", borderRadius: "10px",
    padding: "0 14px", fontSize: "15px", color: "#000",
    backgroundColor: "white", outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div style={{ padding: "43px 45px", backgroundColor: "#fbf8ff", minHeight: "100vh" }}>

      {/* Edit Modal */}
      {editingUser && (
        <div
          style={{
            position: "fixed", inset: 0,
            backgroundColor: "rgba(0,0,0,0.45)",
            zIndex: 200,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={closeEdit}
        >
          <div
            style={{
              backgroundColor: "white", borderRadius: "16px",
              width: "480px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: "22px 28px 18px",
              borderBottom: "1px solid #e7e9ed",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#000", margin: "0 0 3px" }}>
                  Редактировать пользователя
                </h2>
                <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>
                  ID: {editingUser.id} · {editingUser.initial}
                </p>
              </div>
              <button
                onClick={closeEdit}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "24px", color: "#999" }}
              >×</button>
            </div>

            {/* Form */}
            <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "18px" }}>
              {/* Name */}
              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>
                  Полное имя
                </label>
                <input
                  value={editState.name}
                  onChange={(e) => setEditState((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Введите имя"
                  style={inputStyle}
                />
              </div>

              {/* Email */}
              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>
                  Email / Логин
                </label>
                <input
                  type="email"
                  value={editState.email}
                  onChange={(e) => setEditState((p) => ({ ...p, email: e.target.value }))}
                  placeholder="email@example.com"
                  style={inputStyle}
                />
              </div>

              {/* Password */}
              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>
                  Пароль
                </label>
                <div style={{
                  display: "flex", alignItems: "center",
                  border: "1.5px solid #ddd", borderRadius: "10px",
                  overflow: "hidden", backgroundColor: "white",
                }}>
                  <input
                    type={editShowPw ? "text" : "password"}
                    value={editState.password}
                    onChange={(e) => setEditState((p) => ({ ...p, password: e.target.value }))}
                    placeholder="Введите новый пароль"
                    style={{
                      flex: 1, height: "48px",
                      border: "none", outline: "none",
                      padding: "0 14px", fontSize: "15px", color: "#000",
                      backgroundColor: "white",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setEditShowPw(!editShowPw)}
                    style={{
                      background: "none", border: "none",
                      cursor: "pointer", padding: "0 14px",
                      fontSize: "18px", opacity: 0.55,
                    }}
                  >
                    {editShowPw ? "🙈" : "👁"}
                  </button>
                </div>
              </div>

              {/* Role */}
              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>
                  Роль
                </label>
                <div style={{ display: "flex", gap: "10px" }}>
                  {(["teacher", "student"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setEditState((p) => ({ ...p, role: r }))}
                      style={{
                        flex: 1, height: "44px",
                        border: `2px solid ${editState.role === r ? "#142175" : "#ddd"}`,
                        borderRadius: "10px",
                        backgroundColor: editState.role === r ? "#eef0ff" : "white",
                        color: editState.role === r ? "#142175" : "#555",
                        fontSize: "14px", fontWeight: editState.role === r ? 700 : 400,
                        cursor: "pointer", transition: "all 0.15s",
                      }}
                    >
                      {r === "teacher" ? "👨‍🏫 Преподаватель" : "👨‍🎓 Студент"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: "16px 28px 22px",
              borderTop: "1px solid #e7e9ed",
              display: "flex", gap: "10px", justifyContent: "flex-end",
            }}>
              <button
                onClick={closeEdit}
                style={{
                  backgroundColor: "white", color: "#555",
                  border: "1px solid #ddd", borderRadius: "8px",
                  height: "42px", padding: "0 22px",
                  fontSize: "15px", cursor: "pointer",
                }}
              >
                Отмена
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!editState.name.trim() || !editState.email.trim() || !editState.password}
                style={{
                  backgroundColor: "#142175", color: "white",
                  border: "none", borderRadius: "8px",
                  height: "42px", padding: "0 32px",
                  fontSize: "15px", fontWeight: 700, cursor: "pointer",
                  opacity: (!editState.name.trim() || !editState.email.trim() || !editState.password) ? 0.5 : 1,
                }}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowAddModal(false)}
        >
          <div style={{ backgroundColor: "white", borderRadius: "16px", width: "480px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "22px 28px 18px", borderBottom: "1px solid #e7e9ed", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#000", margin: 0 }}>Новый пользователь</h2>
              <button onClick={() => setShowAddModal(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "24px", color: "#999" }}>×</button>
            </div>
            <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "18px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>Полное имя</label>
                <input value={addState.name} onChange={(e) => setAddState((p) => ({ ...p, name: e.target.value }))} placeholder="Введите имя" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>Email / Логин</label>
                <input type="email" value={addState.email} onChange={(e) => setAddState((p) => ({ ...p, email: e.target.value }))} placeholder="email@example.com" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>Пароль</label>
                <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #ddd", borderRadius: "10px", overflow: "hidden", backgroundColor: "white" }}>
                  <input
                    type={addShowPw ? "text" : "password"}
                    value={addState.password}
                    onChange={(e) => setAddState((p) => ({ ...p, password: e.target.value }))}
                    placeholder="Введите пароль"
                    style={{ flex: 1, height: "48px", border: "none", outline: "none", padding: "0 14px", fontSize: "15px", color: "#000", backgroundColor: "white" }}
                  />
                  <button type="button" onClick={() => setAddShowPw(!addShowPw)} style={{ background: "none", border: "none", cursor: "pointer", padding: "0 14px", fontSize: "17px", opacity: 0.5 }}>
                    {addShowPw ? "🙈" : "👁"}
                  </button>
                </div>
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>Роль</label>
                <div style={{ display: "flex", gap: "10px" }}>
                  {(["teacher", "student"] as const).map((r) => (
                    <button key={r} onClick={() => setAddState((p) => ({ ...p, role: r }))} style={{ flex: 1, height: "44px", border: `2px solid ${addState.role === r ? "#142175" : "#ddd"}`, borderRadius: "10px", backgroundColor: addState.role === r ? "#eef0ff" : "white", color: addState.role === r ? "#142175" : "#555", fontSize: "14px", fontWeight: addState.role === r ? 700 : 400, cursor: "pointer" }}>
                      {r === "teacher" ? "👨‍🏫 Преподаватель" : "👨‍🎓 Студент"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ padding: "16px 28px 22px", borderTop: "1px solid #e7e9ed", display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowAddModal(false)} style={{ backgroundColor: "white", color: "#555", border: "1px solid #ddd", borderRadius: "8px", height: "42px", padding: "0 22px", fontSize: "15px", cursor: "pointer" }}>Отмена</button>
              <button
                onClick={handleAddUser}
                disabled={!addState.name.trim() || !addState.email.trim() || !addState.password}
                style={{ backgroundColor: "#142175", color: "white", border: "none", borderRadius: "8px", height: "42px", padding: "0 32px", fontSize: "15px", fontWeight: 700, cursor: "pointer", opacity: (!addState.name.trim() || !addState.email.trim() || !addState.password) ? 0.5 : 1 }}
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "28px" }}>
        {STATS.map((s) => (
          <div key={s.label} style={{
            backgroundColor: "white", border: "1px solid #e7e9ed",
            borderRadius: "12px", padding: "20px 22px",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
              <p style={{ fontSize: "14px", color: "#555", margin: 0, fontWeight: 400 }}>{s.label}</p>
              <span style={{ fontSize: "22px" }}>{s.icon}</span>
            </div>
            <p style={{ fontSize: "32px", fontWeight: 700, color: "#000", margin: "0 0 6px" }}>{s.value}</p>
            <p style={{ fontSize: "13px", color: s.subColor, margin: 0 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Table container */}
      <div style={{
        backgroundColor: "white", border: "1px solid #e7e9ed",
        borderRadius: "12px", overflow: "hidden",
      }}>
        {/* Toolbar */}
        <div style={{
          padding: "16px 20px",
          display: "flex", alignItems: "center", gap: "10px",
          borderBottom: "1px solid #e7e9ed",
        }}>
          <button
            onClick={() => { setAddState({ name: "", email: "", password: "", role: "student" }); setShowAddModal(true); }}
            style={{ backgroundColor: "#142175", color: "white", border: "none", borderRadius: "8px", height: "40px", padding: "0 18px", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}
          >
            + Новый пользователь
          </button>
          <button style={{
            backgroundColor: "white", color: "#333",
            border: "1px solid #ddd", borderRadius: "8px", height: "40px", padding: "0 16px",
            fontSize: "14px", cursor: "pointer",
          }}>
            Роль
          </button>
          <button style={{
            backgroundColor: "white", color: "#333",
            border: "1px solid #ddd", borderRadius: "8px", height: "40px", padding: "0 16px",
            fontSize: "14px", cursor: "pointer",
          }}>
            Дата регистрации
          </button>
          <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>
            <button style={{
              backgroundColor: "white", border: "1px solid #ddd",
              borderRadius: "8px", width: "40px", height: "40px",
              fontSize: "18px", cursor: "pointer",
            }}>⬆</button>
            <button style={{
              backgroundColor: "white", border: "1px solid #ddd",
              borderRadius: "8px", width: "40px", height: "40px",
              fontSize: "18px", cursor: "pointer",
            }}>🖨</button>
          </div>
        </div>

        {/* Table header */}
        <div style={{
          display: "grid", gridTemplateColumns: "2fr 1fr 2fr 1.5fr 110px",
          padding: "12px 20px", borderBottom: "1px solid #e7e9ed",
          backgroundColor: "#fafafa",
        }}>
          {["Полное имя", "Роль", "Email / Логин", "Пароль", "Действия"].map((h) => (
            <p key={h} style={{ fontSize: "13px", fontWeight: 600, color: "#555", margin: 0, textTransform: "uppercase", letterSpacing: "0.4px" }}>{h}</p>
          ))}
        </div>

        {/* Table rows */}
        {users.map((user, i) => (
          <div
            key={user.id}
            style={{
              display: "grid", gridTemplateColumns: "2fr 1fr 2fr 1.5fr 110px",
              padding: "14px 20px", alignItems: "center",
              borderBottom: i < users.length - 1 ? "1px solid #f0eff5" : "none",
              transition: "background 0.1s",
            }}
          >
            {/* Name */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                width: "38px", height: "38px", borderRadius: "50%",
                backgroundColor: user.avatarColor,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "white" }}>{user.initial}</span>
              </div>
              <span style={{ fontSize: "15px", fontWeight: 500, color: "#000" }}>{user.name}</span>
            </div>

            {/* Role badge */}
            <div>
              <span style={{
                backgroundColor: user.role === "teacher" ? "#eef0ff" : "#f0f0f0",
                color: user.role === "teacher" ? "#3525cd" : "#555",
                border: `1px solid ${user.role === "teacher" ? "#c5caff" : "#ddd"}`,
                borderRadius: "6px", padding: "3px 10px",
                fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px",
              }}>
                {user.role === "teacher" ? "Преподаватель" : "Студент"}
              </span>
            </div>

            {/* Email */}
            <span style={{ fontSize: "14px", color: "#444" }}>{user.email}</span>

            {/* Password */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "14px", color: "#666", letterSpacing: showPassword[user.id] ? "0" : "2px" }}>
                {showPassword[user.id] ? user.password : "••••••••••"}
              </span>
              <button
                onClick={() => togglePassword(user.id)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "15px", opacity: 0.55 }}
              >
                {showPassword[user.id] ? "🙈" : "👁"}
              </button>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                onClick={() => openEdit(user)}
                title="Редактировать"
                style={{
                  backgroundColor: "#f0f0ff", border: "1px solid #c5caff",
                  borderRadius: "7px", width: "34px", height: "34px",
                  cursor: "pointer", fontSize: "15px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                ✏️
              </button>
              <button
                onClick={() => handleDelete(user.id)}
                title="Удалить"
                style={{
                  backgroundColor: "#fff0f0", border: "1px solid #fec7c7",
                  borderRadius: "7px", width: "34px", height: "34px",
                  cursor: "pointer", fontSize: "15px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                🗑
              </button>
            </div>
          </div>
        ))}

        {/* Pagination */}
        <div style={{
          padding: "14px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderTop: "1px solid #e7e9ed",
        }}>
          <span style={{ fontSize: "14px", color: "#666" }}>Показано 1–{users.length} из {users.length}</span>
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            {["‹", "1", "2", "3", "...", "129", "›"].map((p, idx) => (
              <button key={idx} style={{
                width: "32px", height: "32px", borderRadius: "6px",
                border: "1px solid #ddd",
                backgroundColor: p === "1" ? "#142175" : "white",
                color: p === "1" ? "white" : "#333",
                fontSize: "14px", cursor: "pointer",
              }}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
