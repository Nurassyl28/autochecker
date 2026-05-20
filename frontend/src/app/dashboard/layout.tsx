"use client";

import Sidebar from "@/components/Sidebar";
import { useEffect, useState } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const saved = (sessionStorage.getItem("user_role") || localStorage.getItem("user_role")) as "student" | "teacher" | null;
    if (saved) setRole(saved);
  }, []);

  function closeSidebar() {
    setSidebarOpen(false);
  }

  return (
    <div className="dashboard-layout" style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--color-bg)" }}>
      {/* Mobile top bar */}
      <div className="mobile-topbar">
        <button
          onClick={() => setSidebarOpen(true)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: "22px", color: "#142175", lineHeight: 1, padding: "4px",
          }}
        >
          ☰
        </button>
        <span style={{ fontSize: "16px", fontWeight: 700, color: "#28247e" }}>Autochecker AI</span>
      </div>

      {/* Overlay for mobile */}
      <div
        className={`sidebar-overlay${sidebarOpen ? " visible" : ""}`}
        onClick={closeSidebar}
      />

      {/* Sidebar */}
      <div className={`dashboard-sidebar${sidebarOpen ? " open" : ""}`}>
        <Sidebar role={role} onClose={closeSidebar} />
      </div>

      <main className="dashboard-main" style={{ flex: 1, overflowY: "auto" }}>
        {children}
      </main>
    </div>
  );
}
