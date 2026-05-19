export type UserRole = "student" | "teacher" | "admin";

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  github_alias?: string;
  tg_username?: string;
  student_group?: string;
  server_ip?: string;
  vm_username?: string;
}

export interface Task {
  lab_id: string;
  task_id: string;
  title: string;
  max_attempts: number;
  status?: TaskStatus;
  score?: string;
  attempts?: number;
  remaining?: number;
  last_attempt?: string;
  deadline?: string;
}

export type TaskStatus = "pass" | "partial" | "fail" | "none" | "in_progress" | "error";

export interface CheckResult {
  id: number;
  lab_id: string;
  task_id: string;
  score: string;
  passed: number;
  failed: number;
  total: number;
  timestamp: string;
  status: TaskStatus;
  checks: CheckDetail[];
}

export interface CheckDetail {
  id: string;
  status: "PASS" | "FAIL" | "ERROR";
  description: string;
  details?: string;
}

export interface Student {
  tg_id: number;
  email: string;
  github_alias: string;
  tg_username: string;
  student_group: string;
  last_submission?: string;
  progress?: number;
  avg_score?: number;
  total_points?: number;
  status?: "active" | "stuck" | "needs_help";
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  initials: string;
  points: number;
  solved: number;
  trend: "up" | "down" | "stable";
  avatar_color?: string;
}

export interface DashboardStats {
  total_students: number;
  active_issues: number;
  stuck: number;
  avg_performance: number;
}

export interface AttemptGrant {
  lab_id: string;
  task_id: string;
  amount: number;
  reason: string;
}

export interface ApiLog {
  id: number;
  student_id: string;
  group: string;
  lab: string;
  task: string;
  score: number | null;
  passed: number;
  failed: number;
  total: number;
  checks: { check_id: string; title: string; passed: boolean }[];
  submitted_at: string;
}

export interface AdminUser {
  id: number;
  name: string;
  role: "teacher" | "student";
  email: string;
}
