"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { logout } from "@/lib/api";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Главная", icon: "/assets/icons/home-icon.png" },
  { href: "/dashboard/top10", label: "TOP-10", icon: "/assets/icons/graduation-cap.png" },
  { href: "/dashboard/students", label: "Студенты", icon: "/assets/icons/people-icon.png", teacherOnly: true },
  { href: "/dashboard/chat", label: "Чат", icon: "/assets/icons/chat-icon.png" },
  { href: "/dashboard/profile", label: "Профиль", icon: "/assets/icons/customer-icon.png" },
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
    <aside
      className="flex flex-col"
      style={{
        width: "288px",
        minWidth: "288px",
        backgroundColor: "var(--color-sidebar)",
        borderRight: "1.5px solid var(--color-border)",
        height: "100vh",
        position: "sticky",
        top: 0,
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 pt-7 pb-6">
        <Image
          src="/assets/icons/graduation-cap.png"
          alt="Autochecker"
          width={27}
          height={27}
          className="object-contain"
        />
        <div>
          <p style={{ fontSize: "16px", fontWeight: 700, color: "var(--color-accent-mid)", lineHeight: "1.2" }}>
            Autochecker AI
          </p>
          <p style={{ fontSize: "11px", color: "var(--color-text-muted)", lineHeight: "1.3" }}>
            Панель управления
          </p>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: "1px", backgroundColor: "var(--color-border)", marginBottom: "8px" }} />

      {/* Navigation */}
      <nav className="flex flex-col gap-1 px-4 flex-1">
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
                display: "flex",
                alignItems: "center",
                gap: "12px",
                height: "48px",
                paddingLeft: "14px",
                paddingRight: "14px",
                borderRadius: "10px",
                fontSize: "15.5px",
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "var(--color-nav-active)" : "var(--color-text-muted)",
                backgroundColor: isActive ? "var(--color-nav-active-bg)" : "transparent",
                border: isActive ? "1px solid var(--color-border)" : "1px solid transparent",
                textDecoration: "none",
                transition: "background-color 0.15s, color 0.15s",
              }}
            >
              <Image
                src={item.icon}
                alt={item.label}
                width={20}
                height={20}
                className="object-contain"
                style={{ opacity: isActive ? 1 : 0.55, filter: dark ? "brightness(0) invert(1)" : "none" }}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-4 pb-6 flex flex-col gap-3">
        {role === "teacher" && (
          <Link
            href="/dashboard/new-assignment"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "44px",
              borderRadius: "10px",
              backgroundColor: "var(--color-btn-primary-bg)",
              color: "var(--color-btn-primary-color)",
              fontSize: "15px",
              fontWeight: 500,
              textDecoration: "none",
              width: "100%",
            }}
          >
            + Новое задание
          </Link>
        )}

        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: "44px",
            paddingLeft: "14px",
            paddingRight: "14px",
            borderRadius: "10px",
            backgroundColor: "transparent",
            border: "1px solid var(--color-border)",
            cursor: "pointer",
            fontSize: "14px",
            color: "var(--color-text-muted)",
            width: "100%",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "18px" }}>{dark ? "☀️" : "🌙"}</span>
            {dark ? "Светлый режим" : "Тёмный режим"}
          </span>
          <span style={{
            width: "36px", height: "20px", borderRadius: "10px",
            backgroundColor: dark ? "#B4C5FF" : "#142175",
            position: "relative", transition: "background 0.2s", flexShrink: 0,
          }}>
            <span style={{
              position: "absolute", top: "2px",
              left: dark ? "18px" : "2px",
              width: "16px", height: "16px", borderRadius: "50%",
              backgroundColor: "white", transition: "left 0.2s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }} />
          </span>
        </button>

        {/* Divider */}
        <div style={{ height: "1px", backgroundColor: "var(--color-border)" }} />

        <button
          onClick={handleLogout}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            height: "44px",
            paddingLeft: "14px",
            borderRadius: "10px",
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: "15px",
            color: "var(--color-text-primary)",
            width: "100%",
          }}
        >
          <Image
            src="/assets/icons/logout-icon.png"
            alt="Выйти"
            width={20}
            height={20}
            className="object-contain"
            style={{ opacity: 0.7, filter: dark ? "brightness(0) invert(1)" : "none" }}
          />
          Выход
        </button>
      </div>
    </aside>
  );
}
