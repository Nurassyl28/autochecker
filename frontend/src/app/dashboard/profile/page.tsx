"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { getToken } from "@/lib/api";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface UserProfile {
  id: number;
  email: string;
  role: string;
  full_name: string;
  tg_id: number | null;
  created_at: string;
}

function initials(name: string, email: string): string {
  const src = name.trim() || email;
  const parts = src.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : src.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS: Record<string, string> = {
  admin: "#7c3aed",
  teacher: "#142175",
  student: "#0d6e4a",
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    fetch(`${BASE_URL}/user/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d: UserProfile) => {
        setProfile(d);
        setEditName(d.full_name || "");
        setEditEmail(d.email || "");
        sessionStorage.setItem("user_name", d.full_name || d.email.split("@")[0]);
        sessionStorage.setItem("user_email", d.email);
        const saved = localStorage.getItem(`avatar_${d.id}`);
        if (saved) setAvatarUrl(saved);
      })
      .finally(() => setLoading(false));
  }, []);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setAvatarUrl(url);
      localStorage.setItem(`avatar_${profile.id}`, url);
    };
    reader.readAsDataURL(file);
  }

  function handleDeleteAvatar() {
    if (!profile) return;
    setAvatarUrl(null);
    localStorage.removeItem(`avatar_${profile.id}`);
  }

  function startEditing() {
    if (!profile) return;
    setEditing(true);
    setEditName(profile.full_name || "");
    setEditEmail(profile.email || "");
    setOldPassword("");
    setNewPassword("");
    setSaveError("");
    setSaveSuccess("");
  }

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    setSaveError("");
    setSaveSuccess("");

    const body: Record<string, string> = {};
    if (editName.trim() !== profile.full_name) body.full_name = editName.trim();
    if (editEmail.trim() !== profile.email) body.email = editEmail.trim();
    if (newPassword) {
      body.old_password = oldPassword;
      body.new_password = newPassword;
    }

    if (Object.keys(body).length === 0) {
      setEditing(false);
      setSaving(false);
      return;
    }

    const token = getToken();
    const r = await fetch(`${BASE_URL}/user/me`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (r.ok) {
      const data = await r.json();
      setProfile((p) => p ? {
        ...p,
        full_name: editName.trim(),
        email: data.email ?? p.email,
      } : p);
      sessionStorage.setItem("user_name", editName.trim() || profile.email.split("@")[0]);
      if (data.email) sessionStorage.setItem("user_email", data.email);
      setSaveSuccess("Сохранено успешно");
      setEditing(false);
    } else {
      const err = await r.json().catch(() => ({}));
      setSaveError((err as { detail?: string }).detail || "Ошибка сохранения");
    }
    setSaving(false);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", height: "48px",
    border: "1.5px solid var(--color-border-input)", borderRadius: "10px",
    padding: "0 14px", fontSize: "15px", color: "var(--color-text-primary)",
    backgroundColor: "var(--color-card)", outline: "none", boxSizing: "border-box",
  };

  if (loading) return (
    <div style={{ padding: "60px 45px", color: "var(--color-text-subtle)", fontSize: "18px" }}>Загрузка...</div>
  );
  if (!profile) return (
    <div style={{ padding: "60px 45px", color: "#e53e3e" }}>Не удалось загрузить профиль.</div>
  );

  const displayName = profile.full_name || profile.email.split("@")[0];
  const avatarColor = AVATAR_COLORS[profile.role] || "#142175";
  const roleLabel = profile.role === "teacher" ? "👨‍🏫 Преподаватель"
    : profile.role === "admin" ? "⚙️ Администратор"
    : "👨‍🎓 Студент";

  return (
    <div style={{ padding: "43px 45px", backgroundColor: "var(--color-bg-alt)", minHeight: "100%" }}>
      <div style={{ maxWidth: "860px" }}>
        <h1 style={{ fontSize: "34px", fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 28px" }}>Профиль</h1>

        <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>

          {/* Left — avatar + quick info */}
          <div style={{ width: "260px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{
              backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
              borderRadius: "14px", padding: "28px 20px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", textAlign: "center",
            }}>
              <div style={{ position: "relative", width: "88px", height: "88px" }}>
                <div style={{ width: "88px", height: "88px", borderRadius: "50%", backgroundColor: avatarColor,
                  display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", cursor: "pointer" }}
                  onClick={() => fileInputRef.current?.click()} title="Загрузить фото">
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarChange} />
                  {avatarUrl
                    ? <img src={avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: "32px", fontWeight: 700, color: "white" }}>{initials(profile.full_name, profile.email)}</span>
                  }
                </div>
                <div style={{
                  position: "absolute", bottom: 0, right: 0,
                  width: "26px", height: "26px", borderRadius: "50%",
                  backgroundColor: "var(--color-btn-primary-bg)", border: "2px solid var(--color-card)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", cursor: "pointer",
                }} onClick={() => fileInputRef.current?.click()}>📷</div>
              </div>

              {avatarUrl && (
                <button onClick={handleDeleteAvatar} style={{
                  background: "none", border: "1px solid #fca5a5", borderRadius: "6px",
                  color: "#b91c1c", fontSize: "12px", padding: "3px 10px", cursor: "pointer",
                }}>
                  🗑 Удалить фото
                </button>
              )}

              <div>
                <p style={{ fontSize: "17px", fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 8px" }}>{displayName}</p>
                <span style={{
                  backgroundColor: profile.role === "student" ? "#ecfdf5" : "#eef0ff",
                  color: profile.role === "student" ? "#0e3e12" : "var(--color-accent)",
                  border: `1px solid ${profile.role === "student" ? "#b5f5d7" : "#c5caff"}`,
                  borderRadius: "8px", padding: "3px 12px",
                  fontSize: "12px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.5px",
                }}>
                  {profile.role === "teacher" ? "Преподаватель" : profile.role === "admin" ? "Администратор" : "Студент"}
                </span>
              </div>
              <p style={{ fontSize: "13px", color: "var(--color-text-subtle)", margin: 0 }}>
                Зарегистрирован: {new Date(profile.created_at).toLocaleDateString("ru-RU")}
              </p>
            </div>

            {/* Contact info */}
            <div style={{
              backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
              borderRadius: "14px", padding: "20px",
            }}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--color-text-subtle)", textTransform: "uppercase" as const, letterSpacing: "0.5px", margin: "0 0 14px" }}>
                Контакты
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div>
                  <p style={{ fontSize: "12px", color: "var(--color-text-subtle)", margin: "0 0 2px" }}>Email</p>
                  <p style={{ fontSize: "14px", color: "var(--color-text-muted)", margin: 0, wordBreak: "break-all" }}>{profile.email}</p>
                </div>
                <div>
                  <p style={{ fontSize: "12px", color: "var(--color-text-subtle)", margin: "0 0 2px" }}>Telegram</p>
                  <p style={{ fontSize: "14px", color: "var(--color-text-muted)", margin: 0 }}>
                    {profile.tg_id ? `ID: ${profile.tg_id}` : "Не привязан"}
                  </p>
                </div>
              </div>
            </div>

            {profile.role === "student" && (
              <Link href="/dashboard/chat" style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                backgroundColor: "var(--color-btn-primary-bg)", color: "var(--color-btn-primary-color)",
                textDecoration: "none", borderRadius: "10px", height: "44px",
                fontSize: "14px", fontWeight: 600,
              }}>
                💬 Написать преподавателю
              </Link>
            )}
          </div>

          {/* Right — editable details */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{
              backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
              borderRadius: "14px", overflow: "hidden",
            }}>
              <div style={{
                padding: "18px 24px", borderBottom: "1px solid var(--color-border-card)",
                backgroundColor: "var(--color-bg-alt)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
                  Личные данные
                </h2>
                {!editing ? (
                  <button onClick={startEditing} style={{
                    backgroundColor: "var(--color-card)", color: "var(--color-accent)",
                    border: "1.5px solid var(--color-accent)", borderRadius: "8px",
                    height: "36px", padding: "0 18px", fontSize: "13px", fontWeight: 600, cursor: "pointer",
                  }}>
                    ✏️ Редактировать
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => { setEditing(false); setSaveError(""); }} style={{
                      backgroundColor: "var(--color-card)", color: "var(--color-text-muted)",
                      border: "1px solid var(--color-border)", borderRadius: "8px",
                      height: "36px", padding: "0 16px", fontSize: "13px", cursor: "pointer",
                    }}>Отмена</button>
                    <button onClick={handleSave} disabled={saving} style={{
                      backgroundColor: "var(--color-btn-primary-bg)", color: "var(--color-btn-primary-color)",
                      border: "none", borderRadius: "8px",
                      height: "36px", padding: "0 18px", fontSize: "13px", fontWeight: 700, cursor: "pointer",
                    }}>{saving ? "..." : "Сохранить"}</button>
                  </div>
                )}
              </div>

              <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
                {/* Name */}
                <div>
                  <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-subtle)", textTransform: "uppercase" as const, letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>
                    Полное имя
                  </label>
                  {editing ? (
                    <input value={editName} onChange={(e) => setEditName(e.target.value)}
                      placeholder="Введите имя и фамилию" style={inputStyle} />
                  ) : (
                    <p style={{ fontSize: "16px", color: "var(--color-text-primary)", margin: 0, padding: "12px 0" }}>
                      {profile.full_name || <span style={{ color: "var(--color-text-subtle)" }}>Не указано</span>}
                    </p>
                  )}
                </div>

                <div style={{ height: "1px", backgroundColor: "var(--color-border-card)" }} />

                {/* Email */}
                <div>
                  <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-subtle)", textTransform: "uppercase" as const, letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>
                    Email (логин)
                  </label>
                  {editing ? (
                    <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="email@example.com" style={inputStyle} />
                  ) : (
                    <p style={{ fontSize: "16px", color: "var(--color-text-primary)", margin: 0, padding: "12px 0" }}>
                      {profile.email}
                    </p>
                  )}
                </div>

                <div style={{ height: "1px", backgroundColor: "var(--color-border-card)" }} />

                {/* Role */}
                <div>
                  <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-subtle)", textTransform: "uppercase" as const, letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>
                    Роль
                  </label>
                  <p style={{ fontSize: "16px", color: "var(--color-text-primary)", margin: 0, padding: "12px 0" }}>
                    {roleLabel}
                  </p>
                </div>

                {/* Password change — only in edit mode */}
                {editing && (
                  <>
                    <div style={{ height: "1px", backgroundColor: "var(--color-border-card)" }} />
                    <div>
                      <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-subtle)", textTransform: "uppercase" as const, letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>
                        Сменить пароль <span style={{ fontWeight: 400, textTransform: "none" }}>(необязательно)</span>
                      </label>
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)}
                          placeholder="Текущий пароль" style={inputStyle} />
                        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Новый пароль" style={inputStyle} />
                      </div>
                    </div>
                  </>
                )}

                {saveError && (
                  <p style={{ color: "#e53e3e", fontSize: "14px", margin: 0 }}>{saveError}</p>
                )}
                {saveSuccess && (
                  <p style={{ color: "#15803d", fontSize: "14px", margin: 0 }}>✅ {saveSuccess}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
