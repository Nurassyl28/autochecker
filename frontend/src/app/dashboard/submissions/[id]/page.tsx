"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getToken } from "@/lib/api";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface CheckResult {
  id: string;
  passed: boolean;
  weight?: number;
  score?: number;
  feedback: string;
  description?: string;
}

interface Submission {
  id: number;
  assignment_id: number;
  assignment_title: string;
  repo_url: string;
  status: string;
  pass_fail: string | null;
  score: number | null;
  created_at: string;
  completed_at: string | null;
  feedback_json: {
    summary?: string;
    pass_fail?: string;
    score?: number;
    teacher_note?: string;
    check_results?: CheckResult[];
  } | null;
}

export default function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [sub, setSub] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    const token = getToken();
    fetch(`${BASE_URL}/student/submissions/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setSub(d))
      .finally(() => setLoading(false));
  }, [id]);

  const askLlm = async () => {
    if (!question.trim()) return;
    setAsking(true);
    setAnswer("");
    const token = getToken();
    const r = await fetch(`${BASE_URL}/student/submissions/${id}/ask`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const d = await r.json();
    setAnswer(d.answer || d.detail || "Нет ответа");
    setAsking(false);
  };

  if (loading) return (
    <div style={{ padding: "60px 45px", color: "var(--color-text-subtle)", fontSize: "18px" }}>Загрузка...</div>
  );
  if (!sub) return (
    <div style={{ padding: "60px 45px", color: "#e53e3e", fontSize: "18px" }}>Результат не найден.</div>
  );

  const scorePct = sub.score != null ? Math.round(sub.score * 100) : null;
  const passed = sub.pass_fail === "pass";
  const topChecks = sub.feedback_json?.check_results ?? [];
  const specChecks = (sub.feedback_json as Record<string, unknown> | null)?.grading_spec
    ? ((sub.feedback_json as Record<string, unknown>).grading_spec as Record<string, unknown>)?.check_results as CheckResult[] ?? []
    : [];
  const checks = topChecks.length > 0 ? topChecks : specChecks;
  const summary = sub.feedback_json?.summary ?? "";
  const teacherNote = sub.feedback_json?.teacher_note ?? "";

  return (
    <div style={{ padding: "43px 45px", backgroundColor: "var(--color-bg)", minHeight: "100%" }}>
      {/* Back */}
      <button onClick={() => router.back()} style={{
        background: "none", border: "none", cursor: "pointer",
        color: "var(--color-accent)", fontSize: "15px", marginBottom: "20px", padding: 0,
      }}>
        ← Назад
      </button>

      {/* Header */}
      <h1 style={{ fontSize: "32px", fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 6px" }}>
        {sub.assignment_title}
      </h1>
      <p style={{ fontSize: "14px", color: "var(--color-text-subtle)", margin: "0 0 28px" }}>
        {sub.repo_url} · {sub.created_at.slice(0, 10)}
      </p>

      {/* Score banner */}
      <div style={{
        display: "flex", alignItems: "center", gap: "20px",
        backgroundColor: passed ? "#ecfdf5" : "#fef2f2",
        border: `1px solid ${passed ? "#6ee7b7" : "#fca5a5"}`,
        borderRadius: "12px", padding: "20px 28px", marginBottom: "28px",
      }}>
        <span style={{ fontSize: "48px", fontWeight: 800, color: passed ? "#065f46" : "#991b1b" }}>
          {scorePct != null ? `${scorePct}%` : "—"}
        </span>
        <div>
          <p style={{ fontSize: "20px", fontWeight: 600, color: passed ? "#065f46" : "#991b1b", margin: 0 }}>
            {passed ? "✅ Сдано" : sub.status === "error" ? "⚠️ Ошибка проверки" : "❌ Не сдано"}
          </p>
          {summary && (
            <p style={{ fontSize: "14px", color: "var(--color-text-muted)", margin: "6px 0 0", maxWidth: "600px" }}>
              {summary}
            </p>
          )}
        </div>
      </div>

      {/* Check results */}
      {checks.length > 0 && (
        <div style={{ marginBottom: "32px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "14px" }}>
            Детали проверки
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {checks.map((c, i) => (
              <div key={i} style={{
                backgroundColor: "var(--color-card)",
                border: `1px solid ${c.passed ? "var(--color-border-card)" : "#fca5a5"}`,
                borderRadius: "10px", padding: "14px 18px",
                display: "flex", gap: "14px", alignItems: "flex-start",
              }}>
                <span style={{ fontSize: "20px", flexShrink: 0 }}>{c.passed ? "✅" : "❌"}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 4px" }}>
                    {c.id}
                    {(c.weight != null || c.score != null) && (
                      <span style={{ fontWeight: 400, color: "var(--color-text-subtle)" }}>
                        {" "}({Math.round((c.weight ?? c.score ?? 0) * 100)}%)
                      </span>
                    )}
                  </p>
                  {c.description && (
                    <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: "0 0 4px" }}>{c.description}</p>
                  )}
                  {c.feedback && (
                    <p style={{ fontSize: "13px", color: c.passed ? "var(--color-text-muted)" : "#991b1b", margin: 0 }}>
                      {c.feedback}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Teacher note from AI */}
      {teacherNote && (
        <div style={{
          backgroundColor: "#fffbeb", border: "1px solid #fde68a",
          borderRadius: "10px", padding: "14px 18px", marginBottom: "28px",
        }}>
          <p style={{ fontSize: "13px", fontWeight: 600, color: "#92400e", margin: "0 0 4px" }}>
            📝 Замечание для преподавателя
          </p>
          <p style={{ fontSize: "13px", color: "#78350f", margin: 0, lineHeight: "1.5" }}>
            {teacherNote}
          </p>
        </div>
      )}

      {/* Ask AI tutor */}
      {sub.status === "done" && (
        <div style={{
          backgroundColor: "var(--color-card)", border: "1px solid var(--color-border-card)",
          borderRadius: "12px", padding: "24px",
        }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 14px" }}>
            💬 Спросить AI-тьютора
          </h2>
          <div style={{ display: "flex", gap: "10px" }}>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && askLlm()}
              placeholder="Почему я провалил check_function_signature?"
              style={{
                flex: 1, padding: "10px 14px", borderRadius: "8px",
                border: "1px solid var(--color-border)", backgroundColor: "var(--color-bg)",
                color: "var(--color-text-primary)", fontSize: "14px",
              }}
            />
            <button onClick={askLlm} disabled={asking} style={{
              padding: "10px 20px", borderRadius: "8px", border: "none",
              backgroundColor: "var(--color-accent)", color: "white",
              fontWeight: 600, cursor: asking ? "not-allowed" : "pointer", fontSize: "14px",
            }}>
              {asking ? "..." : "Спросить"}
            </button>
          </div>
          {answer && (
            <div style={{
              marginTop: "14px", padding: "14px", borderRadius: "8px",
              backgroundColor: "var(--color-card-alt)", fontSize: "14px",
              color: "var(--color-text-primary)", lineHeight: "1.6",
            }}>
              {answer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
