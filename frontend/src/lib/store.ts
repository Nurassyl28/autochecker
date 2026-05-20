// Simple localStorage-based store for demo data
// Replace with real API calls when backend is connected

export interface Assignment {
  id: string;
  title: string;
  deadline: string;
  comment: string;
  createdAt: string;
}

export interface TgStudent {
  id: string;
  name: string;
  tg_username: string;
  email: string;
  initial: string;
}

export interface StudentScore {
  studentId: string;
  assignmentId: string;
  score: number;
}

// ── Assignments ───────────────────────────────────────────────────────────────

export function getAssignments(): Assignment[] {
  try {
    return JSON.parse(localStorage.getItem("assignments") || "[]");
  } catch { return []; }
}

export function saveAssignment(a: Assignment) {
  const list = getAssignments();
  list.unshift(a);
  localStorage.setItem("assignments", JSON.stringify(list));
}

export function deleteAssignment(id: string) {
  const list = getAssignments().filter((a) => a.id !== id);
  localStorage.setItem("assignments", JSON.stringify(list));
}

// ── Telegram-registered students (mock data for demo) ─────────────────────────

const MOCK_TG_STUDENTS: TgStudent[] = [
  { id: "1", name: "Гауһар Султанбекқызы", tg_username: "@gauhar_s", email: "gauhar@student.edu", initial: "Г" },
  { id: "2", name: "Нурасыл Мухамбеталы", tg_username: "@nurasyl_m", email: "nurasyl@student.edu", initial: "Н" },
  { id: "3", name: "Мухаммад Шералхан", tg_username: "@muhammad_sh", email: "muhammad@student.edu", initial: "М" },
  { id: "4", name: "Алинур Азат", tg_username: "@alinur_a", email: "alinur@student.edu", initial: "А" },
  { id: "5", name: "Данияр Байжанов", tg_username: "@daniyar_b", email: "daniyar@student.edu", initial: "Д" },
  { id: "6", name: "Аружан Сейткали", tg_username: "@aruzhan_s", email: "aruzhan@student.edu", initial: "А" },
  { id: "7", name: "Бакжан Болат", tg_username: "@bakzhan_b", email: "bakzhan@student.edu", initial: "Б" },
  { id: "8", name: "Жасулан Қасымов", tg_username: "@zhasulan_k", email: "zhasulan@student.edu", initial: "Ж" },
];

export function getAllTgStudents(): TgStudent[] {
  return MOCK_TG_STUDENTS;
}

// ── Added students (teacher's class) ─────────────────────────────────────────

export function getAddedStudents(): TgStudent[] {
  try {
    return JSON.parse(localStorage.getItem("added_students") || "[]");
  } catch { return []; }
}

export function addStudent(s: TgStudent) {
  const list = getAddedStudents();
  if (!list.find((x) => x.id === s.id)) {
    list.push(s);
    localStorage.setItem("added_students", JSON.stringify(list));
  }
}

export function removeStudent(id: string) {
  const list = getAddedStudents().filter((s) => s.id !== id);
  localStorage.setItem("added_students", JSON.stringify(list));
}

// ── Scores ────────────────────────────────────────────────────────────────────

export function getScores(): StudentScore[] {
  try {
    return JSON.parse(localStorage.getItem("scores") || "[]");
  } catch { return []; }
}

export function saveScores(studentId: string, scores: Record<string, number>) {
  const all = getScores().filter((s) => s.studentId !== studentId);
  Object.entries(scores).forEach(([assignmentId, score]) => {
    all.push({ studentId, assignmentId, score });
  });
  localStorage.setItem("scores", JSON.stringify(all));
}

export function getStudentScores(studentId: string): Record<string, number> {
  return getScores()
    .filter((s) => s.studentId === studentId)
    .reduce((acc, s) => ({ ...acc, [s.assignmentId]: s.score }), {} as Record<string, number>);
}

export function calcStudentStats(studentId: string): { avg: number; total: number } {
  const scores = getScores().filter((s) => s.studentId === studentId);
  if (!scores.length) return { avg: 0, total: 0 };
  const total = scores.reduce((sum, s) => sum + s.score, 0);
  return { avg: Math.round((total / scores.length) * 10) / 10, total };
}

// ── Admin users ───────────────────────────────────────────────────────────────

export interface AdminUser {
  id: number;
  name: string;
  role: "teacher" | "student";
  email: string;
  password: string;
  initial: string;
  avatarColor: string;
}

const DEFAULT_USERS: AdminUser[] = [
  { id: 1, name: "Александр Соколов", role: "teacher", email: "a.sokolov@university.ru", password: "pass1234", initial: "АС", avatarColor: "#1565c0" },
  { id: 2, name: "Мария Козлова", role: "student", email: "m.kozlova@student.edu", password: "pass1234", initial: "МК", avatarColor: "#e91e63" },
  { id: 3, name: "Дмитрий Волков", role: "student", email: "d.volkov@student.edu", password: "pass1234", initial: "ДВ", avatarColor: "#4caf50" },
  { id: 4, name: "Елена Новикова", role: "teacher", email: "e.novikova@university.ru", password: "pass1234", initial: "ЕН", avatarColor: "#9c27b0" },
  { id: 5, name: "Иван Петров", role: "student", email: "i.petrov@student.edu", password: "pass1234", initial: "ИП", avatarColor: "#ff9800" },
];

export function getAdminUsers(): AdminUser[] {
  try {
    const saved = localStorage.getItem("admin_users");
    return saved ? JSON.parse(saved) : DEFAULT_USERS;
  } catch { return DEFAULT_USERS; }
}

export function updateAdminUser(id: number, updates: Partial<AdminUser>) {
  const list = getAdminUsers().map((u) => u.id === id ? { ...u, ...updates } : u);
  localStorage.setItem("admin_users", JSON.stringify(list));
}

export function deleteAdminUser(id: number) {
  const list = getAdminUsers().filter((u) => u.id !== id);
  localStorage.setItem("admin_users", JSON.stringify(list));
}

export function addAdminUser(data: Omit<AdminUser, "id">): AdminUser {
  const list = getAdminUsers();
  const newId = list.length > 0 ? Math.max(...list.map((u) => u.id)) + 1 : 1;
  const newUser: AdminUser = { ...data, id: newId };
  list.push(newUser);
  localStorage.setItem("admin_users", JSON.stringify(list));
  return newUser;
}
