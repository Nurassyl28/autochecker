/**
 * API client for Autochecker backend (FastAPI)
 * Base URL is set via NEXT_PUBLIC_API_URL in .env.local
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function loginTeacher(password: string): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/teacher`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
      credentials: "include",
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

export async function loginStudent(email: string): Promise<Response> {
  return fetch(`${BASE_URL}/api/auth/student`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export function logout() {
  document.cookie = "dash_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  sessionStorage.clear();
}

// ─── Students (teacher) ───────────────────────────────────────────────────────

export async function getStudents(): Promise<Response> {
  return fetch(`${BASE_URL}/api/students`, { credentials: "include" });
}

export async function getStudentDetails(github_alias: string): Promise<Response> {
  return fetch(`${BASE_URL}/api/student/${github_alias}/details`, {
    credentials: "include",
  });
}

export async function editStudent(
  github_alias: string,
  data: {
    email: string;
    github_alias: string;
    tg_username?: string;
    server_ip?: string;
    vm_username?: string;
  }
): Promise<Response> {
  const form = new FormData();
  form.append("email", data.email);
  form.append("github_alias", data.github_alias);
  form.append("tg_username", data.tg_username ?? "");
  form.append("server_ip", data.server_ip ?? "");
  form.append("vm_username", data.vm_username ?? "");
  return fetch(`${BASE_URL}/student/${github_alias}/edit`, {
    method: "POST",
    body: form,
    credentials: "include",
  });
}

export async function freeAttempts(
  github_alias: string,
  lab_id: string,
  task_id: string,
  amount: number = 0
): Promise<Response> {
  const form = new FormData();
  form.append("lab_id", lab_id);
  form.append("task_id", task_id);
  form.append("amount", String(amount));
  return fetch(`${BASE_URL}/student/${github_alias}/attempts/free`, {
    method: "POST",
    body: form,
    credentials: "include",
  });
}

export async function markDone(
  github_alias: string,
  lab_id: string,
  task_id: string
): Promise<Response> {
  const form = new FormData();
  form.append("lab_id", lab_id);
  form.append("task_id", task_id);
  return fetch(`${BASE_URL}/student/${github_alias}/mark-done`, {
    method: "POST",
    body: form,
    credentials: "include",
  });
}

export async function revertDone(
  github_alias: string,
  lab_id: string,
  task_id: string
): Promise<Response> {
  const form = new FormData();
  form.append("lab_id", lab_id);
  form.append("task_id", task_id);
  return fetch(`${BASE_URL}/student/${github_alias}/revert-done`, {
    method: "POST",
    body: form,
    credentials: "include",
  });
}

// ─── Student self-data ────────────────────────────────────────────────────────

export async function getMyData(email: string): Promise<Response> {
  return fetch(`${BASE_URL}/api/me?email=${encodeURIComponent(email)}`);
}

// ─── Dashboard stats ──────────────────────────────────────────────────────────

export async function getDashboardStats(): Promise<Response> {
  return fetch(`${BASE_URL}/api/stats`, { credentials: "include" });
}

export async function getTop10(): Promise<Response> {
  return fetch(`${BASE_URL}/api/top10`, { credentials: "include" });
}

// ─── Labs / Tasks ──────────────────────────────────────────────────────────────

export async function getItems(
  email: string,
  password: string
): Promise<Response> {
  const creds = btoa(`${email}:${password}`);
  return fetch(`${BASE_URL}/api/items`, {
    headers: { Authorization: `Basic ${creds}` },
  });
}

// ─── Logs ─────────────────────────────────────────────────────────────────────

export async function getLogs(
  email: string,
  password: string,
  since?: string,
  limit: number = 500
): Promise<Response> {
  const creds = btoa(`${email}:${password}`);
  const params = new URLSearchParams({ limit: String(limit) });
  if (since) params.set("since", since);
  return fetch(`${BASE_URL}/api/logs?${params}`, {
    headers: { Authorization: `Basic ${creds}` },
  });
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function exportCsvUrl(lab?: string): string {
  return lab ? `${BASE_URL}/export/csv?lab=${lab}` : `${BASE_URL}/export/csv`;
}

// ─── Relay status ─────────────────────────────────────────────────────────────

export async function getRelayStatus(relayToken: string): Promise<Response> {
  return fetch(`${BASE_URL}/relay/status`, {
    headers: { Authorization: `Bearer ${relayToken}` },
  });
}
