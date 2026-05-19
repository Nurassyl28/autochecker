"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { saveAssignment } from "@/lib/store";

export default function NewAssignmentPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [comment, setComment] = useState("");
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");

  function handlePublish() {
    if (!title.trim()) return;
    saveAssignment({
      id: Date.now().toString(),
      title: title.trim(),
      deadline,
      comment,
      createdAt: new Date().toLocaleDateString("ru-RU"),
    });
    router.push("/dashboard");
  }

  return (
    <div style={{ padding: "0", backgroundColor: "var(--color-bg-alt)", minHeight: "100%" }}>
      {/* Top bar */}
      <div style={{
        height: "70px", backgroundColor: "var(--color-topbar)",
        borderBottom: "1px solid var(--color-border)",
        display: "flex", alignItems: "center", padding: "0 45px",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <button
            onClick={() => router.back()}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: "22px", color: "var(--color-text-muted)", padding: 0,
              display: "flex", alignItems: "center",
            }}
          >
            ←
          </button>
          <span style={{ fontSize: "27px", fontWeight: 600, color: "var(--color-text-primary)" }}>Новое задание</span>
        </div>
        <button
          onClick={handlePublish}
          disabled={!title.trim()}
          style={{
            backgroundColor: "var(--color-btn-primary-bg)", color: "var(--color-btn-primary-color)",
            border: "none", borderRadius: "11px",
            height: "38px", padding: "0 24px",
            fontSize: "17px", fontWeight: 500, cursor: title.trim() ? "pointer" : "not-allowed",
            opacity: title.trim() ? 1 : 0.5,
          }}
        >
          Опубликовать задание
        </button>
      </div>

      <div style={{ padding: "32px 45px", display: "flex", gap: "24px", alignItems: "flex-start" }}>
        {/* Left column */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Основная информация */}
          <div style={{
            backgroundColor: "var(--color-bg-alt)", border: "2px solid var(--color-border-card)",
            borderRadius: "13px", padding: "24px 28px",
          }}>
            <h2 style={{ fontSize: "22px", fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 20px" }}>
              Основная информация
            </h2>

            {/* Title + Deadline */}
            <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "16px", color: "var(--color-text-primary)", display: "block", marginBottom: "8px" }}>
                  Название
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Введите название"
                  style={{
                    width: "100%", height: "54px",
                    border: "1px solid var(--color-border-input)", borderRadius: "10px",
                    padding: "0 16px", fontSize: "19px", color: "var(--color-text-primary)",
                    backgroundColor: "var(--color-card)", outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ width: "220px", flexShrink: 0 }}>
                <label style={{ fontSize: "16px", color: "var(--color-text-primary)", display: "block", marginBottom: "8px" }}>
                  Дедлайн
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  style={{
                    width: "100%", height: "54px",
                    border: "1px solid var(--color-border-input)", borderRadius: "10px",
                    padding: "0 16px", fontSize: "16px", color: "var(--color-text-primary)",
                    backgroundColor: "var(--color-card)", outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            {/* ZIP upload */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) setFileName(f.name);
              }}
              onClick={() => document.getElementById("zipInput")?.click()}
              style={{
                border: `2px dashed ${dragOver ? "var(--color-accent)" : "var(--color-border-input)"}`,
                borderRadius: "16px", height: "217px",
                backgroundColor: "var(--color-card)", cursor: "pointer",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: "8px",
                transition: "border-color 0.2s",
              }}
            >
              <div style={{
                width: "55px", height: "55px", borderRadius: "50%",
                backgroundColor: "var(--color-card-input)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Image src="/assets/icons/historical-icon.png" alt="" width={32} height={32} className="object-contain" />
              </div>
              <p style={{ fontSize: "18px", fontWeight: 600, color: "var(--color-text-muted)", margin: 0 }}>
                {fileName || "Перетащите ZIP файл сюда или выберите файл"}
              </p>
              <p style={{ fontSize: "18px", color: "var(--color-text-subtle)", margin: 0 }}>Максимальный размер файла: 50МВ</p>
              <input id="zipInput" type="file" accept=".zip" style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setFileName(f.name); }} />
            </div>
          </div>

          {/* Комментарии */}
          <div style={{
            backgroundColor: "var(--color-bg-alt)", border: "2px solid var(--color-border-card)",
            borderRadius: "13px", padding: "24px 28px",
          }}>
            <h2 style={{ fontSize: "22px", fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 20px" }}>
              Комментарии
            </h2>

            <div style={{ border: "1.4px solid var(--color-border-light)", borderRadius: "7px", overflow: "hidden" }}>
              {/* Toolbar */}
              <div style={{
                backgroundColor: "var(--color-card-subtle)", borderBottom: "1.4px solid var(--color-border-light)",
                padding: "0 16px", height: "45px",
                display: "flex", alignItems: "center", gap: "8px",
              }}>
                <button
                  onMouseDown={(e) => { e.preventDefault(); setBold(!bold); }}
                  style={{
                    fontWeight: 700, fontSize: "16px", color: bold ? "var(--color-accent)" : "var(--color-text-light)",
                    background: "none", border: "none", cursor: "pointer", padding: "2px 6px",
                    borderRadius: "4px", backgroundColor: bold ? "#e0e0ff" : "transparent",
                  }}
                >B</button>
                <button
                  onMouseDown={(e) => { e.preventDefault(); setItalic(!italic); }}
                  style={{
                    fontStyle: "italic", fontWeight: 700, fontSize: "16px",
                    color: italic ? "var(--color-accent)" : "var(--color-text-light)",
                    background: "none", border: "none", cursor: "pointer", padding: "2px 6px",
                    borderRadius: "4px", backgroundColor: italic ? "#e0e0ff" : "transparent",
                  }}
                >I</button>
                <div style={{ width: "1px", height: "15px", backgroundColor: "var(--color-border)" }} />
                <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", opacity: 0.7 }}>
                  📎
                </button>
              </div>
              {/* Textarea */}
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Напишите комментарии к заданию..."
                style={{
                  width: "100%", minHeight: "180px",
                  border: "none", outline: "none", resize: "vertical",
                  padding: "16px", fontSize: "18px", color: "var(--color-text-primary)",
                  backgroundColor: "var(--color-card)", fontFamily: "Inter, sans-serif",
                  fontWeight: bold ? 700 : 400,
                  fontStyle: italic ? "italic" : "normal",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
        </div>

        {/* Right column — preview */}
        <div style={{
          width: "337px", flexShrink: 0,
          backgroundColor: "var(--color-card)", border: "2px solid var(--color-border-light)",
          borderRadius: "13px", overflow: "hidden",
          minHeight: "787px",
        }}>
          <div style={{ padding: "20px 24px", borderBottom: "2px solid var(--color-border-card)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span style={{ fontSize: "16px", opacity: 0.6 }}>👁</span>
              <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-text-light)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Предпросмотр для студента
              </span>
            </div>
          </div>

          <div style={{ padding: "20px 24px" }}>
            {title ? (
              <>
                <h3 style={{ fontSize: "20px", fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 8px" }}>{title}</h3>
                {deadline && (
                  <p style={{ fontSize: "14px", color: "var(--color-text-subtle)", margin: "0 0 12px" }}>
                    Дедлайн: {deadline}
                  </p>
                )}
              </>
            ) : (
              <p style={{ fontSize: "20px", fontWeight: 600, color: "var(--color-text-subtle)", margin: "0 0 8px" }}>Название задании</p>
            )}

            <div style={{ marginTop: "40px", textAlign: "center" }}>
              {comment || fileName ? (
                <p style={{
                  fontSize: "16px", color: "var(--color-text-muted)", lineHeight: "1.6",
                  fontWeight: bold ? 700 : 400,
                  fontStyle: italic ? "italic" : "normal",
                }}>
                  {comment || `Файл: ${fileName}`}
                </p>
              ) : (
                <>
                  <div style={{
                    width: "66px", height: "66px", borderRadius: "50%",
                    backgroundColor: "var(--color-card-input)", margin: "80px auto 16px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Image src="/assets/icons/historical-icon.png" alt="" width={31} height={31} className="object-contain" />
                  </div>
                  <p style={{ fontSize: "18px", color: "var(--color-text-light)", lineHeight: "1.65", maxWidth: "245px", margin: "0 auto" }}>
                    Описание задачи появится здесь после заполнения поля «Комментарии» или загрузки ZIP-файла
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
