"use client";

import Image from "next/image";

const LEADERBOARD = [
  { rank: 1, name: "Алихан А.", initials: "АА", points: "9,850", tasks: 142, trend: "up-left" },
  { rank: 2, name: "Аружан С.", initials: "АС", points: "9,800", tasks: 134, trend: "up-left" },
  { rank: 3, name: "Данияр Б.", initials: "ДБ", points: "8,769", tasks: 128, trend: "up" },
  { rank: 4, name: "Бакжан Б.", initials: "ББ", points: "8,750", tasks: 125, trend: "up-left" },
  { rank: 5, name: "Аяулым Р.", initials: "АР", points: "7,703", tasks: 113, trend: "up" },
  { rank: 6, name: "Алина К.", initials: "АК", points: "7,669", tasks: 110, trend: "down" },
  { rank: 7, name: "Дамир Д.", initials: "ДД", points: "6,663", tasks: 105, trend: "up-left" },
  { rank: 8, name: "Жасулан К.", initials: "ЖК", points: "6,623", tasks: 98, trend: "up-left" },
  { rank: 9, name: "Жанерке Г.", initials: "ЖГ", points: "6,465", tasks: 92, trend: "down" },
  { rank: 10, name: "Расул Н.", initials: "РН", points: "6,389", tasks: 76, trend: "down" },
];

const AVATAR_COLORS = [
  "#1976d2", "#e91e63", "#4caf50", "#9c27b0", "#ff9800",
  "#f44336", "#ffeb3b", "#00bcd4", "#795548", "#607d8b",
];

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "up-left") {
    return (
      <Image src="/assets/icons/arrow-up-left.png" alt="↗" width={27} height={27} className="object-contain"
        style={{ transform: "rotate(180deg) scaleY(-1)" }} />
    );
  }
  if (trend === "up") {
    return (
      <Image src="/assets/icons/arrow-up.png" alt="→" width={27} height={27} className="object-contain"
        style={{ transform: "rotate(90deg)" }} />
    );
  }
  return (
    <Image src="/assets/icons/arrow-down.png" alt="↓" width={27} height={27} className="object-contain" />
  );
}

export default function Top10Page() {
  return (
    <div style={{ padding: "43px 45px", backgroundColor: "var(--color-bg)", minHeight: "100%" }}>
      {/* Header */}
      <h1 style={{ fontSize: "40px", fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 8px" }}>
        Рейтинг студентов: TOP-10
      </h1>
      <p style={{ fontSize: "18px", color: "var(--color-text-muted)", margin: "0 0 32px", fontWeight: 400 }}>
        Академическая успеваемость и активность
      </p>

      <div style={{ display: "flex", gap: "22px", alignItems: "flex-start" }}>
        {/* Leader card */}
        <div style={{
          width: "336px", flexShrink: 0,
          backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
          borderRadius: "11px", padding: "24px",
          display: "flex", flexDirection: "column", alignItems: "center",
          minHeight: "501px",
        }}>
          <Image
            src="/assets/icons/laurel-wreath.png"
            alt="Лидер"
            width={47} height={47}
            className="object-contain"
            style={{ marginBottom: "12px" }}
          />
          <p style={{ fontSize: "24px", fontWeight: 600, color: "var(--color-accent)", margin: "0 0 32px" }}>
            Лидер месяца
          </p>

          {/* Leader avatar */}
          <div style={{
            width: "112px", height: "112px", borderRadius: "50%",
            backgroundColor: AVATAR_COLORS[0],
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: "40px",
          }}>
            <span style={{ fontSize: "40px", fontWeight: 700, color: "white" }}>АА</span>
          </div>

          <p style={{ fontSize: "27px", fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 6px" }}>Алихан М.</p>
          <p style={{ fontSize: "16px", color: "var(--color-text-muted)", margin: 0 }}>9,850 баллов</p>
        </div>

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
            gridTemplateColumns: "60px 48px 1fr 120px 140px 60px",
            padding: "8px 20px 8px",
            borderBottom: "1px solid var(--color-border-light)",
          }}>
            {["Ранг", "", "Студент", "Баллы", "Решено задач", "Прогресс"].map((h, i) => (
              <p key={i} style={{ fontSize: "14px", fontWeight: 500, color: "var(--color-text-muted)", margin: 0, padding: "8px 0" }}>
                {h}
              </p>
            ))}
          </div>

          {/* Table rows */}
          {LEADERBOARD.map((row, i) => (
            <div
              key={row.rank}
              style={{
                display: "grid",
                gridTemplateColumns: "60px 48px 1fr 120px 140px 60px",
                padding: "0 20px",
                borderBottom: i < LEADERBOARD.length - 1 ? "1px solid var(--color-border)" : "none",
                alignItems: "center",
                minHeight: "69px",
              }}
            >
              {/* Rank */}
              <span style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text-muted)" }}>{row.rank}</span>

              {/* Avatar */}
              <div style={{
                width: "38px", height: "38px", borderRadius: "50%",
                backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: "14px", fontWeight: 600, color: "white" }}>{row.initials}</span>
              </div>

              {/* Name */}
              <span style={{ fontSize: "17px", fontWeight: 600, color: "var(--color-text-primary)", paddingLeft: "8px" }}>{row.name}</span>

              {/* Points */}
              <span style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text-primary)" }}>{row.points}</span>

              {/* Tasks */}
              <span style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text-light)" }}>{row.tasks}</span>

              {/* Trend */}
              <div style={{ display: "flex", justifyContent: "center" }}>
                <TrendIcon trend={row.trend} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
