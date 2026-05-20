"use client";

import { useEffect, useState } from "react";
import { getTop10 } from "@/lib/api";

interface LeaderEntry {
  rank: number;
  name: string;
  email: string;
  initials: string;
  points: number;
  solved: number;
  github_alias: string;
  trend: string;
}

const AVATAR_COLORS = [
  "#1976d2", "#e91e63", "#4caf50", "#9c27b0", "#ff9800",
  "#f44336", "#00bcd4", "#795548", "#607d8b", "#3f51b5",
];

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "up")   return <span style={{ fontSize: "18px", color: "#16a34a" }}>↑</span>;
  if (trend === "down") return <span style={{ fontSize: "18px", color: "#dc2626" }}>↓</span>;
  return <span style={{ fontSize: "18px", color: "#9ca3af" }}>→</span>;
}

export default function Top10Page() {
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTop10()
      .then((r) => (r.ok ? r.json() : []))
      .then((data: LeaderEntry[]) => setLeaderboard(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const leader = leaderboard[0] ?? null;

  if (loading) {
    return (
      <div style={{ padding: "60px 45px", textAlign: "center", color: "var(--color-text-subtle)", fontSize: "18px" }}>
        Загрузка...
      </div>
    );
  }

  return (
    <div style={{ padding: "43px 45px", backgroundColor: "var(--color-bg)", minHeight: "100%" }}>
      {/* Header */}
      <h1 style={{ fontSize: "40px", fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 8px" }}>
        Рейтинг студентов: TOP-10
      </h1>
      <p style={{ fontSize: "18px", color: "var(--color-text-muted)", margin: "0 0 32px", fontWeight: 400 }}>
        Академическая успеваемость и активность
      </p>

      {leaderboard.length === 0 ? (
        <div style={{
          backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
          borderRadius: "13px", padding: "60px",
          textAlign: "center", color: "var(--color-text-subtle)", fontSize: "18px",
        }}>
          Данных пока нет. Студенты начнут появляться после первых сдач.
        </div>
      ) : (
        <div style={{ display: "flex", gap: "22px", alignItems: "flex-start" }}>
          {/* Leader card */}
          {leader && (
            <div style={{
              width: "336px", flexShrink: 0,
              backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
              borderRadius: "11px", padding: "24px",
              display: "flex", flexDirection: "column", alignItems: "center",
              minHeight: "400px",
            }}>
              <span style={{ fontSize: "40px", marginBottom: "12px" }}>🏆</span>
              <p style={{ fontSize: "24px", fontWeight: 600, color: "var(--color-accent)", margin: "0 0 32px" }}>
                Лидер месяца
              </p>

              <div style={{
                width: "112px", height: "112px", borderRadius: "50%",
                backgroundColor: AVATAR_COLORS[0],
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: "24px",
              }}>
                <span style={{ fontSize: "40px", fontWeight: 700, color: "white" }}>{leader.initials}</span>
              </div>

              <p style={{ fontSize: "27px", fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 6px" }}>
                {leader.name}
              </p>
              <p style={{ fontSize: "16px", color: "var(--color-text-muted)", margin: "0 0 4px" }}>
                {leader.points.toLocaleString("ru")} баллов
              </p>
              <p style={{ fontSize: "14px", color: "var(--color-text-subtle)", margin: 0 }}>
                Решено задач: {leader.solved}
              </p>
            </div>
          )}

          {/* Leaderboard table */}
          <div style={{
            flex: 1,
            backgroundColor: "var(--color-card)",
            border: "2px solid var(--color-border-light)",
            borderRadius: "10px",
            overflow: "hidden",
          }}>
            {/* Table header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "60px 48px 1fr 130px 140px 60px",
              padding: "8px 20px",
              borderBottom: "1px solid var(--color-border-light)",
            }}>
              {["Ранг", "", "Студент", "Баллы", "Решено задач", "Тренд"].map((h, i) => (
                <p key={i} style={{ fontSize: "14px", fontWeight: 500, color: "var(--color-text-muted)", margin: 0, padding: "8px 0" }}>
                  {h}
                </p>
              ))}
            </div>

            {/* Table rows */}
            {leaderboard.map((row, i) => (
              <div
                key={row.github_alias || i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px 48px 1fr 130px 140px 60px",
                  padding: "0 20px",
                  borderBottom: i < leaderboard.length - 1 ? "1px solid var(--color-border)" : "none",
                  alignItems: "center",
                  minHeight: "69px",
                  backgroundColor: i === 0 ? "var(--color-card-alt)" : "transparent",
                }}
              >
                {/* Rank */}
                <span style={{ fontSize: "16px", fontWeight: 700, color: i < 3 ? "var(--color-accent)" : "var(--color-text-muted)" }}>
                  {row.rank}
                </span>

                {/* Avatar */}
                <div style={{
                  width: "38px", height: "38px", borderRadius: "50%",
                  backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "white" }}>{row.initials}</span>
                </div>

                {/* Name */}
                <span style={{ fontSize: "17px", fontWeight: 600, color: "var(--color-text-primary)", paddingLeft: "8px" }}>
                  {row.name}
                </span>

                {/* Points */}
                <span style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text-primary)" }}>
                  {row.points.toLocaleString("ru")}
                </span>

                {/* Solved */}
                <span style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text-light)" }}>
                  {row.solved}
                </span>

                {/* Trend */}
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <TrendIcon trend={row.trend} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
