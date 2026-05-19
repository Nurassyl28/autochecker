"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface ProfileData {
  name: string;
  email: string;
  role: "teacher" | "student";
  initial: string;
  avatarColor: string;
  tg_username: string;
  joinDate: string;
  group: string;
}

const MOCK_PROFILES: Record<string, ProfileData> = {
  teacher: {
    name: "Нурасыл Мухамбеталы",
    email: "teacher@autochecker.kz",
    role: "teacher",
    initial: "НМ",
    avatarColor: "#142175",
    tg_username: "@nurasyl_teacher",
    joinDate: "1 сентября 2024",
    group: "Кафедра информационных технологий",
  },
  student: {
    name: "Студент Demo",
    email: "student@autochecker.kz",
    role: "student",
    initial: "СД",
    avatarColor: "#0d6e4a",
    tg_username: "@student_demo",
    joinDate: "15 сентября 2024",
    group: "ИТ-2204, JIHC",
  },
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData>(MOCK_PROFILES.student);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editTg, setEditTg] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setAvatarUrl(url);
      localStorage.setItem(`avatar_${profile.role}`, url);
    };
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    const role = ((sessionStorage.getItem("user_role") || localStorage.getItem("user_role")) as "teacher" | "student") || "student";
    setProfile(MOCK_PROFILES[role]);
    setEditName(MOCK_PROFILES[role].name);
    setEditEmail(MOCK_PROFILES[role].email);
    setEditTg(MOCK_PROFILES[role].tg_username);
    const saved = localStorage.getItem(`avatar_${role}`);
    if (saved) setAvatarUrl(saved);
  }, []);

  function handleSave() {
    setProfile((p) => ({ ...p, name: editName, email: editEmail, tg_username: editTg }));
    setEditing(false);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", height: "48px",
    border: "1.5px solid var(--color-border-input)", borderRadius: "10px",
    padding: "0 14px", fontSize: "15px", color: "var(--color-text-primary)",
    backgroundColor: "var(--color-card)", outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div style={{ padding: "43px 45px", backgroundColor: "var(--color-bg-alt)", minHeight: "100%" }}>
      <div style={{ maxWidth: "860px" }}>
        <h1 style={{ fontSize: "34px", fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 28px" }}>Профиль</h1>

        <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>

          {/* Left — avatar + quick info */}
          <div style={{
            width: "260px", flexShrink: 0,
            display: "flex", flexDirection: "column", gap: "16px",
          }}>
            {/* Avatar card */}
            <div style={{
              backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
              borderRadius: "14px", padding: "28px 20px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: "12px",
              textAlign: "center",
            }}>
              <div
                style={{ position: "relative", width: "88px", height: "88px", cursor: "pointer" }}
                onClick={() => fileInputRef.current?.click()}
                title="Загрузить фото"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleAvatarChange}
                />
                <div style={{
                  width: "88px", height: "88px", borderRadius: "50%",
                  backgroundColor: profile.avatarColor,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  overflow: "hidden",
                }}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ fontSize: "32px", fontWeight: 700, color: "white" }}>{profile.initial}</span>
                  )}
                </div>
                <div style={{
                  position: "absolute", bottom: 0, right: 0,
                  width: "26px", height: "26px", borderRadius: "50%",
                  backgroundColor: "var(--color-btn-primary-bg)", border: "2px solid var(--color-card)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "12px",
                }}>
                  📷
                </div>
              </div>
              <div>
                <p style={{ fontSize: "17px", fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 4px" }}>{profile.name}</p>
                <span style={{
                  backgroundColor: profile.role === "teacher" ? "#eef0ff" : "#ecfdf5",
                  color: profile.role === "teacher" ? "var(--color-accent)" : "#0e3e12",
                  border: `1px solid ${profile.role === "teacher" ? "#c5caff" : "#b5f5d7"}`,
                  borderRadius: "8px", padding: "3px 12px",
                  fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px",
                }}>
                  {profile.role === "teacher" ? "Преподаватель" : "Студент"}
                </span>
              </div>
              <p style={{ fontSize: "13px", color: "var(--color-text-subtle)", margin: 0 }}>
                Зарегистрирован: {profile.joinDate}
              </p>
            </div>

            {/* Contact info */}
            <div style={{
              backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
              borderRadius: "14px", padding: "20px",
            }}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--color-text-subtle)", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 14px" }}>
                Контакты
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div>
                  <p style={{ fontSize: "12px", color: "var(--color-text-subtle)", margin: "0 0 2px" }}>Email</p>
                  <p style={{ fontSize: "14px", color: "var(--color-text-muted)", margin: 0, wordBreak: "break-all" }}>{profile.email}</p>
                </div>
                <div>
                  <p style={{ fontSize: "12px", color: "var(--color-text-subtle)", margin: "0 0 2px" }}>Telegram</p>
                  <p style={{ fontSize: "14px", color: "var(--color-accent)", margin: 0 }}>{profile.tg_username}</p>
                </div>
                <div>
                  <p style={{ fontSize: "12px", color: "var(--color-text-subtle)", margin: "0 0 2px" }}>Группа / Кафедра</p>
                  <p style={{ fontSize: "14px", color: "var(--color-text-muted)", margin: 0 }}>{profile.group}</p>
                </div>
              </div>
            </div>

            {/* Chat link for student */}
            {profile.role === "student" && (
              <Link href="/dashboard/chat" style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                backgroundColor: "var(--color-btn-primary-bg)", color: "var(--color-btn-primary-color)", textDecoration: "none",
                borderRadius: "10px", height: "44px",
                fontSize: "14px", fontWeight: 600,
              }}>
                💬 Написать преподавателю
              </Link>
            )}
          </div>

          {/* Right — editable details */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "20px" }}>

            {/* Main info card */}
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
                  <button
                    onClick={() => setEditing(true)}
                    style={{
                      backgroundColor: "var(--color-card)", color: "var(--color-accent)",
                      border: "1.5px solid var(--color-accent)", borderRadius: "8px",
                      height: "36px", padding: "0 18px",
                      fontSize: "13px", fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    ✏️ Редактировать
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => setEditing(false)}
                      style={{
                        backgroundColor: "var(--color-card)", color: "var(--color-text-muted)",
                        border: "1px solid var(--color-border)", borderRadius: "8px",
                        height: "36px", padding: "0 16px",
                        fontSize: "13px", cursor: "pointer",
                      }}
                    >
                      Отмена
                    </button>
                    <button
                      onClick={handleSave}
                      style={{
                        backgroundColor: "var(--color-btn-primary-bg)", color: "var(--color-btn-primary-color)",
                        border: "none", borderRadius: "8px",
                        height: "36px", padding: "0 18px",
                        fontSize: "13px", fontWeight: 700, cursor: "pointer",
                      }}
                    >
                      Сохранить
                    </button>
                  </div>
                )}
              </div>

              <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "18px", backgroundColor: "var(--color-card)" }}>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-subtle)", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>
                    Полное имя
                  </label>
                  {editing ? (
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} style={inputStyle} />
                  ) : (
                    <p style={{ fontSize: "16px", color: "var(--color-text-primary)", margin: 0, padding: "12px 0" }}>{profile.name}</p>
                  )}
                </div>

                <div style={{ height: "1px", backgroundColor: "var(--color-border-card)" }} />

                <div>
                  <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-subtle)", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>
                    Email
                  </label>
                  {editing ? (
                    <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} style={inputStyle} />
                  ) : (
                    <p style={{ fontSize: "16px", color: "var(--color-text-primary)", margin: 0, padding: "12px 0" }}>{profile.email}</p>
                  )}
                </div>

                <div style={{ height: "1px", backgroundColor: "var(--color-border-card)" }} />

                <div>
                  <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-subtle)", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>
                    Telegram
                  </label>
                  {editing ? (
                    <input value={editTg} onChange={(e) => setEditTg(e.target.value)} placeholder="@username" style={inputStyle} />
                  ) : (
                    <p style={{ fontSize: "16px", color: "var(--color-accent)", margin: 0, padding: "12px 0" }}>{profile.tg_username}</p>
                  )}
                </div>

                <div style={{ height: "1px", backgroundColor: "var(--color-border-card)" }} />

                <div>
                  <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-subtle)", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>
                    Роль
                  </label>
                  <p style={{ fontSize: "16px", color: "var(--color-text-primary)", margin: 0, padding: "12px 0" }}>
                    {profile.role === "teacher" ? "👨‍🏫 Преподаватель" : "👨‍🎓 Студент"}
                  </p>
                </div>
              </div>
            </div>

            {/* Security card */}
            <div style={{
              backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
              borderRadius: "14px", padding: "24px",
            }}>
              <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 16px" }}>
                Безопасность
              </h2>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: "15px", fontWeight: 500, color: "var(--color-text-primary)", margin: "0 0 4px" }}>Пароль</p>
                  <p style={{ fontSize: "13px", color: "var(--color-text-subtle)", margin: 0 }}>Последнее изменение: никогда</p>
                </div>
                <button style={{
                  backgroundColor: "var(--color-card)", color: "var(--color-accent)",
                  border: "1.5px solid var(--color-accent)", borderRadius: "8px",
                  height: "36px", padding: "0 18px",
                  fontSize: "13px", fontWeight: 600, cursor: "pointer",
                }}>
                  Сменить пароль
                </button>
              </div>
            </div>

            {/* Credentials box */}
            <div style={{
              backgroundColor: "var(--color-card-alt)", border: "1px solid var(--color-border-card)",
              borderRadius: "12px", padding: "16px 20px",
              fontSize: "13px", color: "var(--color-accent)",
            }}>
              <p style={{ fontWeight: 700, margin: "0 0 6px" }}>Ваши данные для входа:</p>
              <p style={{ margin: "0 0 2px" }}>
                📧 Email: <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{profile.email}</span>
              </p>
              <p style={{ margin: 0 }}>
                🔑 Пароль: <span style={{ fontFamily: "monospace", fontWeight: 600 }}>
                  {profile.role === "teacher" ? "teacher123" : "student123"}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
