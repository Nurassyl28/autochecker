"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getChatPartners, getChatConversations, getChatMessages, sendChatMessage } from "@/lib/api";

interface Partner {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
}

interface Conversation {
  user: Partner;
  last_message_at: string;
}

interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  body: string;
  created_at: string;
  read_at: string | null;
}


const BG_COLORS = ["#e8e4f0", "#fce4ec", "#e3f2fd", "#e8f5e9", "#fff3e0", "#f3e5f5"];
const TXT_COLORS = ["#5566cc", "#c62828", "#1565c0", "#2e7d32", "#e65100", "#6a1b9a"];

function partnerInitials(p: Partner): string {
  const name = p.full_name || p.email;
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function displayName(p: Partner): string {
  return p.full_name || p.email.split("@")[0];
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function ChatInner() {
  const searchParams = useSearchParams();
  const preselect = searchParams.get("partner"); // numeric id

  const [role, setRole] = useState<"teacher" | "student">("student");
  const [myId, setMyId] = useState<number>(0);
  const [myName, setMyName] = useState<string>("Я");
  const [partners, setPartners] = useState<(Partner)[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Init user info from session
  useEffect(() => {
    const r = (sessionStorage.getItem("user_role") || "student") as "teacher" | "student";
    const id = Number(sessionStorage.getItem("user_id") || "0");
    const name = sessionStorage.getItem("user_name") || (r === "teacher" ? "Преподаватель" : "Студент");
    setRole(r);
    setMyId(id);
    setMyName(name);
  }, []);

  // Load contacts list — all available partners + merge last-message timestamps
  useEffect(() => {
    if (!role) return;

    async function loadContacts() {
      // Get all available partners (teachers for students, students for teachers)
      const partnersRes = await getChatPartners();
      const allPartners: Partner[] = partnersRes.ok ? await partnersRes.json() : [];

      // Get existing conversations to show last-message time
      const convsRes = await getChatConversations();
      const convs: Conversation[] = convsRes.ok ? await convsRes.json() : [];
      const lastMsgMap: Record<number, string> = {};
      for (const c of convs) lastMsgMap[c.user.id] = c.last_message_at;

      // Sort: partners with messages first (by last_message_at desc), then rest alphabetically
      const sorted = [...allPartners].sort((a, b) => {
        const ta = lastMsgMap[a.id] ?? "";
        const tb = lastMsgMap[b.id] ?? "";
        if (ta && tb) return tb.localeCompare(ta);
        if (ta) return -1;
        if (tb) return 1;
        return (a.full_name || a.email).localeCompare(b.full_name || b.email);
      });

      setPartners(sorted);
      const targetId = preselect ? Number(preselect) : (sorted[0]?.id ?? null);
      setSelectedId(targetId);
    }

    loadContacts();
  }, [role, preselect]);

  // Load and poll messages when selected partner changes
  const loadMessages = useCallback(async () => {
    if (!selectedId) return;
    const res = await getChatMessages(selectedId, 50);
    if (res.ok) {
      const data: Message[] = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    }
  }, [selectedId]);

  useEffect(() => {
    setMessages([]);
    if (!selectedId) return;
    loadMessages();
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(loadMessages, 8000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedId, loadMessages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || !selectedId || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    const res = await sendChatMessage(selectedId, text);
    if (res.ok) {
      await loadMessages();
    }
    setSending(false);
  }

  const activePartner = partners.find((p) => p.id === selectedId) ?? null;

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "var(--color-bg-alt)" }}>

      {/* Contacts panel */}
      <div style={{
        width: "300px", flexShrink: 0,
        borderRight: "1.5px solid var(--color-border)",
        backgroundColor: "var(--color-card)",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "20px 18px 12px", borderBottom: "1px solid var(--color-border)" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 12px" }}>Чат</h2>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {partners.map((p, i) => {
            const isSelected = selectedId === p.id;
            const bg = BG_COLORS[i % BG_COLORS.length];
            const tx = TXT_COLORS[i % TXT_COLORS.length];
            const initials = partnerInitials(p);

            return (
              <div
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "12px 18px",
                  cursor: "pointer",
                  backgroundColor: isSelected ? "var(--color-card-subtle)" : "transparent",
                  borderLeft: isSelected ? "3px solid var(--color-accent)" : "3px solid transparent",
                  borderBottom: "1px solid var(--color-card-subtle)",
                  transition: "background 0.1s",
                }}
              >
                <div style={{
                  width: "46px", height: "46px", borderRadius: "50%",
                  backgroundColor: bg, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ fontSize: "15px", fontWeight: 700, color: tx }}>{initials}</span>
                </div>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <span style={{
                    display: "block", fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>{displayName(p)}</span>
                  <span style={{
                    display: "block", fontSize: "12px", color: "var(--color-text-subtle)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    marginTop: "2px",
                  }}>{p.email}</span>
                </div>
              </div>
            );
          })}
          {partners.length === 0 && (
            <p style={{ padding: "24px 18px", fontSize: "14px", color: "var(--color-text-subtle)", textAlign: "center" }}>
              {role === "teacher" ? "Нет студентов." : "Нет активных чатов."}
            </p>
          )}
        </div>
      </div>

      {/* Chat area */}
      {activePartner ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Header */}
          <div style={{
            height: "68px", backgroundColor: "var(--color-card)",
            borderBottom: "1.5px solid var(--color-border)",
            display: "flex", alignItems: "center", padding: "0 24px", gap: "14px",
            flexShrink: 0,
          }}>
            <div style={{
              width: "44px", height: "44px", borderRadius: "50%",
              backgroundColor: BG_COLORS[partners.indexOf(activePartner) % BG_COLORS.length],
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: "15px", fontWeight: 700, color: TXT_COLORS[partners.indexOf(activePartner) % TXT_COLORS.length] }}>
                {partnerInitials(activePartner)}
              </span>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "var(--color-text-primary)" }}>{displayName(activePartner)}</p>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--color-text-subtle)" }}>{activePartner.email}</p>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: "auto",
            padding: "24px 28px",
            display: "flex", flexDirection: "column", gap: "10px",
            backgroundColor: "var(--color-card-alt)",
          }}>
            {messages.map((msg) => {
              const isMe = msg.sender_id === myId;
              return (
                <div key={msg.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
                  {!isMe && (
                    <div style={{
                      width: "30px", height: "30px", borderRadius: "50%",
                      backgroundColor: "var(--color-card-input)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, marginRight: "8px", alignSelf: "flex-end",
                      fontSize: "11px", fontWeight: 700, color: "var(--color-text-muted)",
                    }}>
                      {partnerInitials(activePartner).slice(0, 2)}
                    </div>
                  )}
                  <div style={{ maxWidth: "62%" }}>
                    <div style={{
                      backgroundColor: isMe ? "var(--color-btn-primary-bg)" : "var(--color-card)",
                      color: isMe ? "var(--color-btn-primary-color)" : "var(--color-text-primary)",
                      borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      padding: "10px 16px",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
                      border: isMe ? "none" : "1px solid var(--color-border)",
                    }}>
                      <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.55", whiteSpace: "pre-wrap" }}>{msg.body}</p>
                      <p style={{ margin: "4px 0 0", fontSize: "11px", opacity: 0.55, textAlign: "right" }}>
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            {messages.length === 0 && (
              <p style={{ textAlign: "center", color: "var(--color-text-subtle)", fontSize: "14px", marginTop: "40px" }}>
                Напишите первое сообщение
              </p>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: "12px 20px",
            backgroundColor: "var(--color-card)",
            borderTop: "1.5px solid var(--color-border)",
            display: "flex", gap: "10px", alignItems: "flex-end",
            flexShrink: 0,
          }}>
            <div style={{
              flex: 1,
              backgroundColor: "var(--color-card-subtle)", border: "1.5px solid var(--color-border-card)",
              borderRadius: "12px", padding: "10px 16px",
            }}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                placeholder={`Написать ${displayName(activePartner)}... (Enter — отправить)`}
                rows={1}
                style={{
                  width: "100%", border: "none", outline: "none",
                  background: "transparent", fontSize: "14px", color: "var(--color-text-primary)",
                  resize: "none", fontFamily: "Inter, sans-serif", lineHeight: "1.5",
                }}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              style={{
                width: "44px", height: "44px",
                backgroundColor: input.trim() ? "var(--color-btn-primary-bg)" : "var(--color-border)",
                border: "none", borderRadius: "12px",
                cursor: input.trim() ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, transition: "background 0.15s",
                fontSize: "18px", color: "var(--color-btn-primary-color)",
              }}
            >
              ➤
            </button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "12px", color: "var(--color-text-subtle)" }}>
          <span style={{ fontSize: "48px" }}>💬</span>
          <p style={{ fontSize: "18px", margin: 0 }}>Выберите чат слева</p>
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", color: "var(--color-text-subtle)" }}>Загрузка...</div>}>
      <ChatInner />
    </Suspense>
  );
}
