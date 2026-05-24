"use client";

import { useState, useEffect, useCallback } from "react";
import { getAdminToken } from "@/lib/api";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface User {
  id: number;
  email: string;
  full_name: string | null;
  role: "admin" | "teacher" | "student";
}

interface ClassRow {
  id: number;
  name: string;
  teacher_id: number | null;
  teacher_name: string | null;
  teacher_email: string | null;
  student_count: number;
  created_at: string;
}

interface ClassDetail extends ClassRow {
  students: { id: number; full_name: string | null; email: string }[];
}

function adminHeaders(extra: Record<string, string> = {}): HeadersInit {
  const t = getAdminToken();
  return t ? { Authorization: `Bearer ${t}`, ...extra } : extra;
}

const btnBase: React.CSSProperties = {
  height: "38px", padding: "0 18px", borderRadius: "8px",
  fontSize: "14px", fontWeight: 600, cursor: "pointer", border: "none",
};
const inputStyle: React.CSSProperties = {
  height: "38px", padding: "0 12px", border: "1px solid #d1d5db",
  borderRadius: "8px", fontSize: "14px", outline: "none",
};

export default function AdminClasses({ users }: { users: User[] }) {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  const [newClass, setNewClass] = useState({ name: "", teacher_id: "" });
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);

  const [expandedClass, setExpandedClass] = useState<number | null>(null);
  const [classDetail, setClassDetail] = useState<ClassDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [addStudentIds, setAddStudentIds] = useState<number[]>([]);

  const [editingClassId, setEditingClassId] = useState<number | null>(null);
  const [editClassForm, setEditClassForm] = useState({ name: "", teacher_id: "" });
  const [editClassLoading, setEditClassLoading] = useState(false);
  const [editClassError, setEditClassError] = useState("");

  const teachers = users.filter((u) => u.role === "teacher");
  const students = users.filter((u) => u.role === "student");

  const loadClasses = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`${BASE_URL}/admin/classes`, { headers: adminHeaders() });
    if (res.ok) setClasses(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { loadClasses(); }, [loadClasses]);

  const loadClassDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    const res = await fetch(`${BASE_URL}/admin/classes/${id}`, { headers: adminHeaders() });
    if (res.ok) setClassDetail(await res.json());
    setDetailLoading(false);
  }, []);

  useEffect(() => {
    if (expandedClass != null) loadClassDetail(expandedClass);
    else setClassDetail(null);
  }, [expandedClass, loadClassDetail]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newClass.name.trim()) { setCreateError("Введите название класса"); return; }
    setCreateLoading(true);
    setCreateError("");
    const res = await fetch(`${BASE_URL}/admin/classes`, {
      method: "POST",
      headers: adminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        name: newClass.name.trim(),
        teacher_id: newClass.teacher_id ? Number(newClass.teacher_id) : null,
        student_ids: selectedStudents,
      }),
    });
    if (res.ok) {
      setShowCreate(false);
      setNewClass({ name: "", teacher_id: "" });
      setSelectedStudents([]);
      await loadClasses();
    } else {
      const err = await res.json().catch(() => ({}));
      const detail = (err as { detail?: unknown }).detail;
      setCreateError(typeof detail === "string" ? detail : "Ошибка создания класса");
    }
    setCreateLoading(false);
  }

  async function handleEditClass(e: React.FormEvent) {
    e.preventDefault();
    if (!editingClassId) return;
    setEditClassLoading(true);
    setEditClassError("");
    const body: Record<string, string | number | null> = {};
    if (editClassForm.name.trim()) body.name = editClassForm.name.trim();
    body.teacher_id = editClassForm.teacher_id ? Number(editClassForm.teacher_id) : null;
    const res = await fetch(`${BASE_URL}/admin/classes/${editingClassId}`, {
      method: "PATCH",
      headers: adminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setEditingClassId(null);
      await loadClasses();
    } else {
      const err = await res.json().catch(() => ({}));
      const detail = (err as { detail?: unknown }).detail;
      setEditClassError(typeof detail === "string" ? detail : "Ошибка обновления");
    }
    setEditClassLoading(false);
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Удалить класс "${name}"?`)) return;
    await fetch(`${BASE_URL}/admin/classes/${id}`, { method: "DELETE", headers: adminHeaders() });
    if (expandedClass === id) setExpandedClass(null);
    await loadClasses();
  }

  async function handleRemoveStudent(classId: number, studentId: number) {
    await fetch(`${BASE_URL}/admin/classes/${classId}/members/${studentId}`, { method: "DELETE", headers: adminHeaders() });
    await loadClassDetail(classId);
    await loadClasses();
  }

  async function handleAddStudents(classId: number) {
    if (addStudentIds.length === 0) return;
    await fetch(`${BASE_URL}/admin/classes/${classId}/members`, {
      method: "POST",
      headers: adminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ student_ids: addStudentIds }),
    });
    setAddStudentIds([]);
    await loadClassDetail(classId);
    await loadClasses();
  }

  function toggleStudent(id: number, list: number[], setList: (l: number[]) => void) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  const existingStudentIds = classDetail?.students.map((s) => s.id) ?? [];
  const availableToAdd = students.filter((s) => !existingStudentIds.includes(s.id));

  return (
    <div style={{ backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "16px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: 0 }}>Классы ({classes.length})</h2>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={loadClasses} style={{ ...btnBase, backgroundColor: "#f3f4f6", color: "#374151" }}>↻ Обновить</button>
          <button onClick={() => setShowCreate(true)} style={{ ...btnBase, backgroundColor: "#142175", color: "white" }}>+ Создать класс</button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #e5e7eb", backgroundColor: "#f9fafb" }}>
          <h3 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 16px", color: "#111" }}>Новый класс</h3>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "14px", maxWidth: "600px" }}>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <input
                type="text" placeholder="Название класса (напр. «Группа A»)" required
                value={newClass.name}
                onChange={(e) => setNewClass((p) => ({ ...p, name: e.target.value }))}
                style={{ ...inputStyle, minWidth: "220px", flex: 1 }}
              />
              <select
                value={newClass.teacher_id}
                onChange={(e) => setNewClass((p) => ({ ...p, teacher_id: e.target.value }))}
                style={{ ...inputStyle, minWidth: "180px" }}
              >
                <option value="">— Выберите учителя —</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.full_name || t.email}</option>
                ))}
              </select>
            </div>

            {/* Student multi-select */}
            <div>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "#374151", margin: "0 0 6px" }}>
                Добавить студентов ({selectedStudents.length} выбрано)
              </p>
              <div style={{ maxHeight: "180px", overflowY: "auto", border: "1px solid #d1d5db", borderRadius: "8px", backgroundColor: "white" }}>
                {students.length === 0 ? (
                  <p style={{ padding: "12px", color: "#9ca3af", fontSize: "13px", margin: 0 }}>Студентов нет</p>
                ) : students.map((s) => (
                  <label key={s.id} style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "8px 12px", cursor: "pointer",
                    borderBottom: "1px solid #f3f4f6",
                    backgroundColor: selectedStudents.includes(s.id) ? "#eff6ff" : "transparent",
                  }}>
                    <input
                      type="checkbox"
                      checked={selectedStudents.includes(s.id)}
                      onChange={() => toggleStudent(s.id, selectedStudents, setSelectedStudents)}
                    />
                    <span style={{ fontSize: "13px", color: "#111" }}>{s.full_name || s.email}</span>
                    <span style={{ fontSize: "12px", color: "#6b7280", marginLeft: "auto" }}>{s.email}</span>
                  </label>
                ))}
              </div>
            </div>

            {createError && <p style={{ color: "#e53e3e", fontSize: "13px", margin: 0 }}>{createError}</p>}

            <div style={{ display: "flex", gap: "8px" }}>
              <button type="submit" disabled={createLoading}
                style={{ ...btnBase, backgroundColor: "#142175", color: "white", opacity: createLoading ? 0.6 : 1 }}>
                {createLoading ? "Создаём..." : "Создать"}
              </button>
              <button type="button" onClick={() => { setShowCreate(false); setCreateError(""); setSelectedStudents([]); }}
                style={{ ...btnBase, backgroundColor: "#f3f4f6", color: "#374151" }}>
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Classes list */}
      {loading ? (
        <div style={{ padding: "48px", textAlign: "center", color: "#9ca3af" }}>Загрузка...</div>
      ) : classes.length === 0 ? (
        <div style={{ padding: "48px", textAlign: "center", color: "#9ca3af" }}>Классов нет. Создайте первый!</div>
      ) : classes.map((cls, i) => {
        const isExpanded = expandedClass === cls.id;
        const isEditing = editingClassId === cls.id;
        return (
          <div key={cls.id} style={{ borderBottom: i < classes.length - 1 ? "1px solid #f3f4f6" : "none" }}>
            {/* Class row */}
            <div style={{ display: "flex", alignItems: "center", padding: "14px 24px", gap: "16px" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fafafa")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
              <span style={{ fontSize: "13px", color: "#9ca3af", fontFamily: "monospace", flexShrink: 0 }}>#{cls.id}</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 3px", fontSize: "15px", fontWeight: 600, color: "#111" }}>{cls.name}</p>
                <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>
                  {cls.teacher_name ? `👨‍🏫 ${cls.teacher_name}` : "Учитель не назначен"}
                  {" · "}
                  {cls.student_count} студент{cls.student_count === 1 ? "" : cls.student_count < 5 ? "а" : "ов"}
                </p>
              </div>
              <span style={{ fontSize: "12px", color: "#9ca3af", flexShrink: 0 }}>{cls.created_at.slice(0, 10)}</span>
              <button onClick={() => {
                  if (isEditing) { setEditingClassId(null); }
                  else { setEditingClassId(cls.id); setEditClassForm({ name: cls.name, teacher_id: cls.teacher_id ? String(cls.teacher_id) : "" }); setEditClassError(""); }
                }}
                style={{ ...btnBase, height: "30px", padding: "0 12px", fontSize: "12px",
                  backgroundColor: isEditing ? "#142175" : "#f3f4f6", color: isEditing ? "white" : "#374151" }}>
                {isEditing ? "Закрыть" : "✏️ Изменить"}
              </button>
              <button onClick={() => setExpandedClass(isExpanded ? null : cls.id)}
                style={{ ...btnBase, height: "30px", padding: "0 12px", fontSize: "12px",
                  backgroundColor: isExpanded ? "#142175" : "#eff6ff", color: isExpanded ? "white" : "#1d4ed8" }}>
                {isExpanded ? "Скрыть" : "Управление"}
              </button>
              <button onClick={() => handleDelete(cls.id, cls.name)}
                style={{ ...btnBase, height: "30px", padding: "0 12px", backgroundColor: "#fee2e2", color: "#b91c1c", fontSize: "12px" }}>
                Удалить
              </button>
            </div>

            {/* Edit form */}
            {isEditing && (
              <div style={{ padding: "16px 24px 20px", backgroundColor: "#fffbeb", borderTop: "1px solid #fde68a" }}>
                <form onSubmit={handleEditClass} style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Название</label>
                    <input type="text" required value={editClassForm.name}
                      onChange={(e) => setEditClassForm((p) => ({ ...p, name: e.target.value }))}
                      style={{ ...inputStyle, minWidth: "220px" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Учитель</label>
                    <select value={editClassForm.teacher_id}
                      onChange={(e) => setEditClassForm((p) => ({ ...p, teacher_id: e.target.value }))}
                      style={{ ...inputStyle, minWidth: "200px" }}>
                      <option value="">— Без учителя —</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>{t.full_name || t.email}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" disabled={editClassLoading}
                    style={{ ...btnBase, backgroundColor: "#142175", color: "white", opacity: editClassLoading ? 0.6 : 1 }}>
                    {editClassLoading ? "Сохраняем..." : "Сохранить"}
                  </button>
                </form>
                {editClassError && <p style={{ color: "#e53e3e", fontSize: "13px", margin: "8px 0 0" }}>{editClassError}</p>}
              </div>
            )}

            {/* Expanded detail */}
            {isExpanded && (
              <div style={{ padding: "16px 24px 20px", backgroundColor: "#f8fafc", borderTop: "1px solid #e5e7eb" }}>
                {detailLoading ? (
                  <p style={{ color: "#9ca3af", fontSize: "13px" }}>Загрузка...</p>
                ) : classDetail && classDetail.id === cls.id ? (
                  <div style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>
                    {/* Students in class */}
                    <div style={{ flex: 1, minWidth: "260px" }}>
                      <p style={{ fontSize: "12px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 10px" }}>
                        Студенты класса ({classDetail.students.length})
                      </p>
                      {classDetail.students.length === 0 ? (
                        <p style={{ fontSize: "13px", color: "#9ca3af" }}>Студентов нет</p>
                      ) : classDetail.students.map((s) => (
                        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 0", borderBottom: "1px solid #e5e7eb" }}>
                          <span style={{ fontSize: "13px", color: "#111", flex: 1 }}>{s.full_name || s.email}</span>
                          <span style={{ fontSize: "12px", color: "#6b7280" }}>{s.email}</span>
                          <button onClick={() => handleRemoveStudent(cls.id, s.id)}
                            style={{ ...btnBase, height: "26px", padding: "0 10px", fontSize: "11px", backgroundColor: "#fee2e2", color: "#b91c1c" }}>
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add students */}
                    {availableToAdd.length > 0 && (
                      <div style={{ minWidth: "260px" }}>
                        <p style={{ fontSize: "12px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 10px" }}>
                          Добавить студентов ({addStudentIds.length} выбрано)
                        </p>
                        <div style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid #d1d5db", borderRadius: "8px", backgroundColor: "white", marginBottom: "10px" }}>
                          {availableToAdd.map((s) => (
                            <label key={s.id} style={{
                              display: "flex", alignItems: "center", gap: "10px",
                              padding: "7px 12px", cursor: "pointer",
                              borderBottom: "1px solid #f3f4f6",
                              backgroundColor: addStudentIds.includes(s.id) ? "#eff6ff" : "transparent",
                            }}>
                              <input type="checkbox" checked={addStudentIds.includes(s.id)}
                                onChange={() => toggleStudent(s.id, addStudentIds, setAddStudentIds)} />
                              <span style={{ fontSize: "13px", color: "#111" }}>{s.full_name || s.email}</span>
                            </label>
                          ))}
                        </div>
                        <button
                          onClick={() => handleAddStudents(cls.id)}
                          disabled={addStudentIds.length === 0}
                          style={{ ...btnBase, height: "34px", backgroundColor: "#142175", color: "white", opacity: addStudentIds.length === 0 ? 0.5 : 1 }}>
                          Добавить выбранных
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
