"use client";

import { useState, useEffect, useRef } from "react";
import { getToken } from "@/lib/api";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Assignment {
  id: number;
  title: string;
  description_text: string;
  spec_status: "pending" | "generating" | "ready" | "failed";
  llm_spec: { checks?: { id: string; description: string; weight: number }[] } | null;
  created_at: string;
}

const SPEC_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  pending:    { label: "⏳ Ожидание",  bg: "#fef9c3", color: "#a16207" },
  generating: { label: "🔄 Генерация", bg: "#eff6ff", color: "#1d4ed8" },
  ready:      { label: "✅ Готово",    bg: "#dcfce7", color: "#15803d" },
  failed:     { label: "❌ Ошибка",    bg: "#fee2e2", color: "#b91c1c" },
};

export default function NewAssignmentPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSpec, setExpandedSpec] = useState<number | null>(null);

  const [mode, setMode] = useState<"text" | "file">("text");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  function authHeader(): HeadersInit {
    const t = getToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
  }

  async function loadAssignments() {
    setLoading(true);
    const res = await fetch(`${BASE_URL}/teacher/assignments`, { headers: authHeader() });
    if (res.ok) setAssignments(await res.json());
    setLoading(false);
  }

  useEffect(() => { loadAssignments(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) { setError("Введите название задания"); return; }
    setSaving(true);
    try {
      let res: Response;
      if (mode === "file" && file) {
        const fd = new FormData();
        fd.append("title", title.trim());
        fd.append("file", file);
        res = await fetch(`${BASE_URL}/teacher/assignments/upload`, {
          method: "POST",
          headers: authHeader(),
          body: fd,
        });
      } else {
        if (!description.trim()) { setError("Введите описание задания"); setSaving(false); return; }
        res = await fetch(`${BASE_URL}/teacher/assignments`, {
          method: "POST",
          headers: { ...(authHeader() as Record<string, string>), "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), description_text: description.trim() }),
        });
      }
      if (res.ok) {
        setTitle(""); setDescription(""); setFile(null); setShowForm(false);
        await loadAssignments();
      } else {
        const err = await res.json().catch(() => ({}));
        const detail = (err as { detail?: unknown }).detail;
        setError(
          typeof detail === "string" ? detail
          : Array.isArray(detail) ? detail.map((d: { msg?: string }) => d.msg ?? "").join("; ")
          : "Ошибка создания задания"
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number, taskTitle: string) {
    if (!confirm(`Удалить задание "${taskTitle}"?`)) return;
    await fetch(`${BASE_URL}/teacher/assignments/${id}`, { method: "DELETE", headers: authHeader() });
    await loadAssignments();
  }

  const inputStyle: React.CSSProperties = {
    height: "44px", padding: "0 14px", borderRadius: "10px",
    border: "1.5px solid var(--color-border-input)", fontSize: "15px",
    color: "var(--color-text-primary)", backgroundColor: "var(--color-card)",
    outline: "none", width: "100%", boxSizing: "border-box",
  };

  return (
    <div style={{ padding: "43px 45px", backgroundColor: "var(--color-bg-alt)", minHeight: "100%" }}>
      <div style={{ maxWidth: "900px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
          <div>
            <h1 style={{ fontSize: "34px", fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 6px" }}>Задания</h1>
            <p style={{ fontSize: "16px", color: "var(--color-text-muted)", margin: 0 }}>
              Создавайте задания — LLM автоматически сгенерирует критерии проверки.
            </p>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setError(""); }}
            style={{
              height: "42px", padding: "0 20px", borderRadius: "10px",
              backgroundColor: "var(--color-btn-primary-bg)", color: "var(--color-btn-primary-color)",
              border: "none", fontSize: "15px", fontWeight: 600, cursor: "pointer",
            }}
          >
            {showForm ? "✕ Отмена" : "+ Новое задание"}
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <div style={{
            backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
            borderRadius: "14px", padding: "24px", marginBottom: "24px",
          }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 20px" }}>
              Новое задание
            </h2>

            {/* Mode toggle */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "18px" }}>
              {(["text", "file"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} style={{
                  height: "36px", padding: "0 18px", borderRadius: "8px",
                  backgroundColor: mode === m ? "var(--color-accent)" : "var(--color-bg-alt)",
                  color: mode === m ? "white" : "var(--color-text-muted)",
                  border: `1px solid ${mode === m ? "var(--color-accent)" : "var(--color-border-input)"}`,
                  fontSize: "14px", fontWeight: 600, cursor: "pointer",
                }}>
                  {m === "text" ? "✏️ Текстом" : "📎 Файл (.txt .md .pdf .docx)"}
                </button>
              ))}
            </div>

            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <input
                type="text" placeholder="Название задания" value={title}
                onChange={(e) => setTitle(e.target.value)} required style={inputStyle}
              />

              {mode === "text" ? (
                <textarea
                  placeholder="Описание задания — требования, примеры, что студент должен реализовать..."
                  value={description} onChange={(e) => setDescription(e.target.value)} rows={6}
                  style={{
                    padding: "12px 14px", borderRadius: "10px",
                    border: "1.5px solid var(--color-border-input)", fontSize: "14px",
                    color: "var(--color-text-primary)", backgroundColor: "var(--color-card)",
                    outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: "1.55",
                  }}
                />
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: "2px dashed var(--color-border-input)", borderRadius: "10px",
                    padding: "28px", textAlign: "center", cursor: "pointer",
                    backgroundColor: "var(--color-bg-alt)",
                  }}
                >
                  <input ref={fileInputRef} type="file" accept=".txt,.md,.pdf,.docx"
                    style={{ display: "none" }} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  {file
                    ? <p style={{ fontSize: "15px", color: "var(--color-text-primary)", margin: 0 }}>📄 {file.name}</p>
                    : <>
                        <p style={{ fontSize: "15px", color: "var(--color-text-muted)", margin: "0 0 6px" }}>Нажмите чтобы выбрать файл</p>
                        <p style={{ fontSize: "13px", color: "var(--color-text-subtle)", margin: 0 }}>Поддерживается: .txt .md .pdf .docx</p>
                      </>
                  }
                </div>
              )}

              <p style={{ fontSize: "12px", color: "var(--color-text-subtle)", margin: 0 }}>
                💡 После создания LLM сгенерирует критерии проверки. Статус изменится на «Готово».
              </p>

              {error && <p style={{ fontSize: "13px", color: "#e53e3e", margin: 0 }}>{error}</p>}

              <button type="submit" disabled={saving} style={{
                height: "42px", padding: "0 22px", borderRadius: "10px", alignSelf: "flex-start",
                backgroundColor: "var(--color-btn-primary-bg)", color: "var(--color-btn-primary-color)",
                border: "none", fontSize: "14px", fontWeight: 700, cursor: "pointer",
                opacity: saving ? 0.6 : 1,
              }}>
                {saving ? "Создаём..." : "Создать задание"}
              </button>
            </form>
          </div>
        )}

        {/* List */}
        <div style={{
          backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
          borderRadius: "14px", overflow: "hidden",
        }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--color-border-card)", backgroundColor: "var(--color-bg-alt)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
              Все задания ({assignments.length})
            </h2>
            <button onClick={loadAssignments} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "var(--color-text-muted)" }} title="Обновить">↻</button>
          </div>

          {loading ? (
            <div style={{ padding: "48px", textAlign: "center", color: "var(--color-text-subtle)", fontSize: "16px" }}>Загрузка...</div>
          ) : assignments.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center", color: "var(--color-text-subtle)", fontSize: "15px" }}>Заданий нет. Создайте первое!</div>
          ) : assignments.map((a, i) => {
            const spec = SPEC_STATUS[a.spec_status] ?? SPEC_STATUS.pending;
            const isExpanded = expandedSpec === a.id;
            const checks = a.llm_spec?.checks ?? [];
            return (
              <div key={a.id} style={{ borderBottom: i < assignments.length - 1 ? "1px solid var(--color-border-card)" : "none" }}>
                <div style={{ padding: "16px 24px", display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 600, color: "var(--color-text-primary)" }}>{a.title}</p>
                    <p style={{ margin: 0, fontSize: "12px", color: "var(--color-text-subtle)" }}>Создано: {a.created_at.slice(0, 10)}</p>
                  </div>
                  <span style={{ fontSize: "12px", fontWeight: 600, padding: "3px 12px", borderRadius: "12px", backgroundColor: spec.bg, color: spec.color, whiteSpace: "nowrap" }}>
                    {spec.label}
                  </span>
                  {a.llm_spec && (
                    <button
                      onClick={() => setExpandedSpec(isExpanded ? null : a.id)}
                      style={{
                        height: "32px", padding: "0 14px", borderRadius: "8px",
                        backgroundColor: isExpanded ? "var(--color-accent)" : "var(--color-bg-alt)",
                        color: isExpanded ? "white" : "var(--color-text-muted)",
                        border: `1px solid ${isExpanded ? "var(--color-accent)" : "var(--color-border-input)"}`,
                        fontSize: "13px", cursor: "pointer",
                      }}
                    >
                      {isExpanded ? "Скрыть spec" : "Просмотр spec"}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(a.id, a.title)}
                    style={{ height: "32px", padding: "0 14px", borderRadius: "8px", backgroundColor: "#fee2e2", color: "#b91c1c", border: "none", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
                  >
                    Удалить
                  </button>
                </div>

                {isExpanded && a.llm_spec && (
                  <div style={{ padding: "16px 24px", backgroundColor: "var(--color-bg-alt)", borderTop: "1px solid var(--color-border-card)" }}>
                    <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-subtle)", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 12px" }}>
                      Критерии проверки (spec)
                    </p>
                    {checks.length > 0
                      ? checks.map((c, ci) => (
                          <div key={ci} style={{ display: "flex", gap: "12px", padding: "8px 0", borderBottom: ci < checks.length - 1 ? "1px solid var(--color-border-card)" : "none" }}>
                            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-accent)", flexShrink: 0, minWidth: "32px" }}>
                              {Math.round(c.weight * 100)}%
                            </span>
                            <div>
                              <p style={{ margin: "0 0 2px", fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)" }}>{c.id}</p>
                              <p style={{ margin: 0, fontSize: "12px", color: "var(--color-text-muted)" }}>{c.description}</p>
                            </div>
                          </div>
                        ))
                      : <pre style={{ fontSize: "12px", color: "var(--color-text-muted)", overflow: "auto", maxHeight: "300px", margin: 0 }}>{JSON.stringify(a.llm_spec, null, 2)}</pre>
                    }
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
