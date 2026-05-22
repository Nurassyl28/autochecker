"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { logout } from "@/lib/api";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Главная",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: "/dashboard/top10",
    label: "ТОП-10",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
      </svg>
    ),
  },
  {
    href: "/dashboard/students",
    label: "Студенты",
    teacherOnly: true,
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    href: "/dashboard/chat",
    label: "Чат",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/profile",
    label: "Профиль",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

interface SidebarProps {
  role?: "student" | "teacher";
  onClose?: () => void;
}

export default function Sidebar({ role = "student", onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("dark_mode") === "true";
    setDark(saved);
    document.documentElement.classList.toggle("dark", saved);
  }, []);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("dark_mode", String(next));
  }

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <aside style={{
      width: "256px", minWidth: "256px",
      backgroundColor: "var(--color-sidebar)",
      borderRight: "1px solid var(--color-border)",
      height: "100vh",
      position: "sticky", top: 0,
      display: "flex", flexDirection: "column",
    }}>
      {/* Logo */}
      <div style={{ padding: "24px 20px 20px", display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{
          width: "36px", height: "36px", borderRadius: "8px",
          backgroundColor: "#142175",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c3 3 9 3 12 0v-5" />
          </svg>
        </div>
        <div>
          <p style={{ fontSize: "15px", fontWeight: 700, color: "var(--color-accent)", margin: 0, lineHeight: "1.2" }}>
            Autochecker AI
          </p>
          <p style={{ fontSize: "11px", color: "var(--color-text-muted)", margin: 0, lineHeight: "1.3" }}>
            Панель управления
          </p>
        </div>
      </div>

      <div style={{ height: "1px", backgroundColor: "var(--color-border)", margin: "0 16px 12px" }} />

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "0 12px", display: "flex", flexDirection: "column", gap: "2px" }}>
        {NAV_ITEMS.filter((item) => !item.teacherOnly || role === "teacher").map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              style={{
                display: "flex", alignItems: "center", gap: "12px",
                height: "44px", padding: "0 14px", borderRadius: "10px",
                fontSize: "15px", fontWeight: isActive ? 600 : 400,
                color: isActive ? "var(--color-nav-active)" : "var(--color-text-muted)",
                backgroundColor: isActive ? "var(--color-nav-active-bg)" : "transparent",
                textDecoration: "none",
                transition: "background-color 0.15s, color 0.15s",
              }}
            >
              <span style={{ flexShrink: 0, display: "flex" }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div style={{ padding: "12px 12px 20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        {role === "teacher" && (
          <Link
            href="/dashboard/new-assignment"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              height: "42px", borderRadius: "10px",
              backgroundColor: "var(--color-btn-primary-bg)", color: "var(--color-btn-primary-color)",
              fontSize: "14px", fontWeight: 600, textDecoration: "none", width: "100%",
            }}
          >
            + Новое задание
          </Link>
        )}

        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            height: "40px", padding: "0 14px", borderRadius: "10px",
            backgroundColor: "transparent", border: "1px solid var(--color-border)",
            cursor: "pointer", fontSize: "13px", color: "var(--color-text-muted)", width: "100%",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "16px" }}>{dark ? "☀️" : "🌙"}</span>
            {dark ? "Светлый режим" : "Тёмный режим"}
          </span>
          <span style={{
            width: "32px", height: "18px", borderRadius: "9px",
            backgroundColor: dark ? "#B4C5FF" : "#142175",
            position: "relative", transition: "background 0.2s", flexShrink: 0,
          }}>
            <span style={{
              position: "absolute", top: "2px",
              left: dark ? "16px" : "2px",
              width: "14px", height: "14px", borderRadius: "50%",
              backgroundColor: "white", transition: "left 0.2s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }} />
          </span>
        </button>

        <div style={{ height: "1px", backgroundColor: "var(--color-border)" }} />

        <button
          onClick={handleLogout}
          style={{
            display: "flex", alignItems: "center", gap: "10px",
            height: "40px", padding: "0 14px", borderRadius: "10px",
            backgroundColor: "transparent", border: "none",
            cursor: "pointer", fontSize: "14px", color: "var(--color-text-muted)", width: "100%",
          }}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Выход
        </button>
      </div>
    </aside>
  );
}
