"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getAddedStudents, getAllTgStudents, type TgStudent } from "@/lib/store";
import { supabase, type DbMessage } from "@/lib/supabase";

interface Contact {
  id: string;
  name: string;
  initial: string;
  initialColor: string;
  bgColor: string;
  subtitle: string;
  isAI?: boolean;
}

const BG_COLORS = ["#e8e4f0", "#fce4ec", "#e3f2fd", "#e8f5e9", "#fff3e0", "#f3e5f5"];
const TXT_COLORS = ["#5566cc", "#c62828", "#1565c0", "#2e7d32", "#e65100", "#6a1b9a"];

function studentToContact(s: TgStudent, i: number): Contact {
  return {
    id: s.id,
    name: s.name,
    initial: s.initial,
    initialColor: TXT_COLORS[i % TXT_COLORS.length],
    bgColor: BG_COLORS[i % BG_COLORS.length],
    subtitle: s.tg_username,
  };
}

const TEACHER_CONTACT: Contact = {
  id: "teacher_nurasyl",
  name: "Нурасыл М. (Преподаватель)",
  initial: "НМ",
  initialColor: "#5566cc",
  bgColor: "#e8e4f0",
  subtitle: "Ваш преподаватель",
};

const AI_CONTACT: Contact = {
  id: "ai",
  name: "AI-Тьютор",
  initial: "AI",
  initialColor: "#fff",
  bgColor: "#3344aa",
  subtitle: "Автоматический помощник",
  isAI: true,
};

// Local AI messages stored in memory (not Supabase)
const aiMessages: DbMessage[] = [
  {
    id: "ai-seed",
    room_id: "ai",
    sender: "ai",
    sender_name: "AI-Тьютор",
    sender_role: "teacher",
    text: "Привет! Я AI-тьютор. Задайте любой вопрос по вашему заданию.",
    created_at: new Date(Date.now() - 60000).toISOString(),
  },
];

function roomId(studentId: string): string {
  return `room_${studentId}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function ChatInner() {
  const searchParams = useSearchParams();
  const preselect = searchParams.get("student");

  const [role, setRole] = useState<"teacher" | "student">("student");
  const [myUserId, setMyUserId] = useState<string>("2");
  const [myName, setMyName] = useState<string>("Студент");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DbMessage[]>([]);
  const [lastTexts, setLastTexts] = useState<Record<string, string>>({});
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Init role + contacts
  useEffect(() => {
    const r = ((sessionStorage.getItem("user_role") || localStorage.getItem("user_role")) as "teacher" | "student") || "student";
    const uid = sessionStorage.getItem("user_id") || localStorage.getItem("user_id") || "3";
    const name = sessionStorage.getItem("user_name") || localStorage.getItem("user_name") || (r === "teacher" ? "Нурасыл М." : "Мухаммад Шералхан");
    setRole(r);
    setMyUserId(uid);
    setMyName(name);

    let list: Contact[];
    if (r === "teacher") {
      const added = getAddedStudents();
      const all = getAllTgStudents();
      const merged = [...added, ...all.filter((t) => !added.find((a) => a.id === t.id))];
      list = merged.map((s, i) => studentToContact(s, i));
    } else {
      list = [TEACHER_CONTACT, AI_CONTACT];
    }
    setContacts(list);

    const first = preselect
      ? list.find((c) => c.id === preselect)?.id ?? list[0]?.id
      : list[0]?.id;
    setSelectedId(first ?? null);
  }, [preselect]);

  // Resolve the Supabase room for the selected contact
  function getRoom(contactId: string): string {
    if (role === "teacher") return roomId(contactId);   // teacher → room_<studentId>
    if (contactId === "ai") return "ai";
    return roomId(myUserId);                            // student → room_<myId>
  }

  // Load messages + subscribe to realtime when contact changes
  useEffect(() => {
    if (!selectedId) return;

    const room = getRoom(selectedId);

    // AI is local only
    if (room === "ai") {
      setMessages([...aiMessages]);
      return;
    }

    // Fetch existing messages
    supabase
      .from("messages")
      .select("*")
      .eq("room_id", room)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setMessages((data as DbMessage[]) ?? []);
      });

    // Unsubscribe previous
    if (subRef.current) {
      supabase.removeChannel(subRef.current);
    }

    // Subscribe to new messages in this room
    const channel = supabase
      .channel(`room:${room}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${room}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as DbMessage]);
        }
      )
      .subscribe();

    subRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, role, myUserId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Update last message preview for contact list
  useEffect(() => {
    if (!selectedId) return;
    const last = messages[messages.length - 1];
    if (last) {
      setLastTexts((prev) => ({ ...prev, [selectedId]: last.text.slice(0, 42) }));
    }
  }, [messages, selectedId]);

  async function sendMessage() {
    if (!input.trim() || !selectedId || sending) return;
    const text = input.trim();
    setInput("");

    const room = getRoom(selectedId);

    // AI response (local)
    if (room === "ai") {
      const myMsg: DbMessage = {
        id: String(Date.now()),
        room_id: "ai",
        sender: myUserId,
        sender_name: myName,
        sender_role: role,
        text,
        created_at: new Date().toISOString(),
      };
      aiMessages.push(myMsg);
      setMessages([...aiMessages]);

      setTimeout(() => {
        const reply: DbMessage = {
          id: String(Date.now() + 1),
          room_id: "ai",
          sender: "ai",
          sender_name: "AI-Тьютор",
          sender_role: "teacher",
          text: "Хороший вопрос! Проверьте документацию или попробуйте разбить задачу на шаги.",
          created_at: new Date().toISOString(),
        };
        aiMessages.push(reply);
        setMessages([...aiMessages]);
      }, 1200);
      return;
    }

    setSending(true);
    await supabase.from("messages").insert({
      room_id: room,
      sender: myUserId,
      sender_name: myName,
      sender_role: role,
      text,
    });
    setSending(false);
  }

  const activeContact = contacts.find((c) => c.id === selectedId) ?? null;

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "var(--color-bg-alt)" }}>

      {/* ── Contacts panel ── */}
      <div style={{
        width: "300px", flexShrink: 0,
        borderRight: "1.5px solid var(--color-border)",
        backgroundColor: "var(--color-card)",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "20px 18px 12px", borderBottom: "1px solid var(--color-border)" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 12px" }}>Чат</h2>
          <div style={{
            backgroundColor: "var(--color-card-subtle)", border: "1px solid var(--color-border-card)",
            borderRadius: "8px", height: "38px",
            display: "flex", alignItems: "center", gap: "8px", padding: "0 12px",
          }}>
            <span style={{ fontSize: "14px", opacity: 0.4 }}>🔍</span>
            <input placeholder="Поиск..." style={{ border: "none", outline: "none", background: "transparent", fontSize: "14px", flex: 1, color: "var(--color-text-primary)" }} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {contacts.map((c) => {
            const isSelected = selectedId === c.id;
            return (
              <div
                key={c.id}
                onClick={() => setSelectedId(c.id)}
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
                  backgroundColor: c.bgColor, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ fontSize: c.isAI ? "11px" : "16px", fontWeight: 700, color: c.initialColor }}>
                    {c.initial}
                  </span>
                </div>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <span style={{
                    display: "block", fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>{c.name}</span>
                  <span style={{
                    display: "block", fontSize: "12px", color: "var(--color-text-subtle)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    marginTop: "2px",
                  }}>{lastTexts[c.id] ?? c.subtitle}</span>
                </div>
              </div>
            );
          })}
          {contacts.length === 0 && (
            <p style={{ padding: "24px 18px", fontSize: "14px", color: "var(--color-text-subtle)", textAlign: "center" }}>
              {role === "teacher" ? "Нет добавленных студентов." : "Нет контактов."}
            </p>
          )}
        </div>
      </div>

      {/* ── Chat area ── */}
      {activeContact ? (
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
              backgroundColor: activeContact.bgColor,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: activeContact.isAI ? "11px" : "16px", fontWeight: 700, color: activeContact.initialColor }}>
                {activeContact.initial}
              </span>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "var(--color-text-primary)" }}>{activeContact.name}</p>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--color-text-subtle)" }}>
                {activeContact.isAI ? "AI-помощник" : "● онлайн"}
              </p>
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
              const isMe = msg.sender === myUserId;
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
                      {msg.sender_name?.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div style={{ maxWidth: "62%" }}>
                    {!isMe && (
                      <p style={{ margin: "0 0 4px 4px", fontSize: "11px", color: "var(--color-text-subtle)", fontWeight: 600 }}>
                        {msg.sender_name}
                      </p>
                    )}
                    <div style={{
                      backgroundColor: isMe ? "var(--color-btn-primary-bg)" : "var(--color-card)",
                      color: isMe ? "var(--color-btn-primary-color)" : "var(--color-text-primary)",
                      borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      padding: "10px 16px",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
                      border: isMe ? "none" : "1px solid var(--color-border)",
                    }}>
                      <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.55", whiteSpace: "pre-wrap" }}>{msg.text}</p>
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
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                }}
                placeholder="Написать сообщение... (Enter — отправить)"
                rows={1}
                style={{
                  width: "100%", border: "none", outline: "none",
                  background: "transparent", fontSize: "14px", color: "var(--color-text-primary)",
                  resize: "none", fontFamily: "Inter, sans-serif", lineHeight: "1.5",
                }}
              />
            </div>
            <button
              onClick={sendMessage}
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
