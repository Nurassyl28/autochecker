/**
 * API client for Autochecker v2 backend (FastAPI + PostgreSQL + JWT)
 * Base URL: NEXT_PUBLIC_API_URL in .env.local
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── JWT token management ──────────────────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("auth_token") || localStorage.getItem("auth_token");
}

export function setToken(token: string): void {
  sessionStorage.setItem("auth_token", token);
  localStorage.setItem("auth_token", token);
}

function authHeaders(extra: Record<string, string> = {}): HeadersInit {
  const token = getToken();
  const base: Record<string, string> = { "Content-Type": "application/json", ...extra };
  if (token) base["Authorization"] = `Bearer ${token}`;
  return base;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface LoginResult {
  ok: boolean;
  role?: string;
  user_id?: number;
  full_name?: string;
  university_id?: number;
  error?: string;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: (err as { detail?: string }).detail || "Ошибка авторизации" };
    }
    const data = await res.json();
    setToken(data.access_token);
    return {
      ok: true,
      role: data.role,
      user_id: data.user_id,
      full_name: data.full_name,
      university_id: data.university_id,
    };
  } catch {
    return { ok: false, error: "Ошибка подключения к серверу" };
  }
}

export function logout(): void {
  sessionStorage.clear();
  localStorage.removeItem("auth_token");
}

// ── Teacher endpoints ─────────────────────────────────────────────────────────

export async function getStudents(): Promise<Response> {
  return fetch(`${BASE_URL}/teacher/students`, { headers: authHeaders() });
}

export async function getStudentDetails(studentId: string | number): Promise<Response> {
  return fetch(`${BASE_URL}/teacher/students/${studentId}`, { headers: authHeaders() });
}

export async function getTeacherSubmissions(assignmentId?: number): Promise<Response> {
  const url = assignmentId
    ? `${BASE_URL}/teacher/submissions?assignment_id=${assignmentId}`
    : `${BASE_URL}/teacher/submissions`;
  return fetch(url, { headers: authHeaders() });
}

export async function getTeacherAssignments(): Promise<Response> {
  return fetch(`${BASE_URL}/teacher/assignments`, { headers: authHeaders() });
}

// Stats are computed locally from the students list — no separate /stats endpoint in v2
export async function getDashboardStats(): Promise<Response> {
  return fetch(`${BASE_URL}/teacher/students`, { headers: authHeaders() });
}

// ── Student endpoints ─────────────────────────────────────────────────────────

export async function getStudentAssignments(): Promise<Response> {
  return fetch(`${BASE_URL}/student/assignments`, { headers: authHeaders() });
}

export async function getStudentSubmissions(): Promise<Response> {
  return fetch(`${BASE_URL}/student/submissions`, { headers: authHeaders() });
}

/** Returns both assignments and submissions in parallel for the student dashboard. */
export async function getMyData(): Promise<{ assignments: unknown[]; submissions: unknown[] }> {
  const [aRes, sRes] = await Promise.all([
    fetch(`${BASE_URL}/student/assignments`, { headers: authHeaders() }),
    fetch(`${BASE_URL}/student/submissions`, { headers: authHeaders() }),
  ]);
  const [assignments, submissions] = await Promise.all([
    aRes.ok ? aRes.json() : [],
    sRes.ok ? sRes.json() : [],
  ]);
  return { assignments, submissions };
}

export async function submitRepo(assignmentId: number, repoUrl: string): Promise<Response> {
  return fetch(`${BASE_URL}/student/submit`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ assignment_id: assignmentId, repo_url: repoUrl }),
  });
}

export async function getSubmissionDetail(submissionId: number): Promise<Response> {
  return fetch(`${BASE_URL}/student/submissions/${submissionId}`, { headers: authHeaders() });
}

export async function askLlm(submissionId: number, question: string): Promise<Response> {
  return fetch(`${BASE_URL}/student/submissions/${submissionId}/ask`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ question }),
  });
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export async function getChatConversations(): Promise<Response> {
  return fetch(`${BASE_URL}/chat/conversations`, { headers: authHeaders() });
}

export async function getChatMessages(
  otherUserId: number,
  limit = 50,
  beforeId?: number
): Promise<Response> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (beforeId != null) params.set("before_id", String(beforeId));
  return fetch(`${BASE_URL}/chat/${otherUserId}?${params}`, { headers: authHeaders() });
}

export async function sendChatMessage(otherUserId: number, body: string): Promise<Response> {
  return fetch(`${BASE_URL}/chat/${otherUserId}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ body }),
  });
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export async function adminGetUsers(): Promise<Response> {
  return fetch(`${BASE_URL}/admin/users`, { headers: authHeaders() });
}

export async function adminCreateUser(data: {
  email: string;
  password: string;
  full_name: string;
  role: "teacher" | "student";
}): Promise<Response> {
  return fetch(`${BASE_URL}/admin/users`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
}

export async function adminDeleteUser(userId: number): Promise<Response> {
  return fetch(`${BASE_URL}/admin/users/${userId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}

export async function adminGetAssignments(): Promise<Response> {
  return fetch(`${BASE_URL}/admin/assignments`, { headers: authHeaders() });
}

export async function adminCreateAssignment(data: FormData): Promise<Response> {
  const token = getToken();
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
  return fetch(`${BASE_URL}/admin/assignments`, { method: "POST", headers, body: data });
}

export function exportCsvUrl(): string {
  return `${BASE_URL}/admin/export/csv`;
}
