# Autochecker Frontend

Next.js 15 + React 19 + Tailwind CSS v4 + TypeScript

---

## Быстрый старт

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
```

---

## Подключение к бэкенду

### 1. Переменная окружения

Создай файл `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=https://your-domain.com
```

Без этого файла фронт обращается к `http://localhost:8000` (для локальной разработки).

### 2. CORS на бэкенде

FastAPI должен разрешать запросы с фронтенд-домена:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-frontend-domain.com", "http://localhost:3000"],
    allow_credentials=True,   # важно — для cookie-аутентификации
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 3. Cookie-аутентификация

Учительский логин (`POST /login`) возвращает cookie `dash_auth`. Фронт отправляет его автоматически через `credentials: "include"` во всех запросах к `/api/*` и `/student/*`.

---

## API-контракт

Все функции находятся в `src/lib/api.ts`. Ниже — сводная таблица.

### Аутентификация

| Метод | Endpoint | Тело | Ответ |
|-------|----------|------|-------|
| POST | `/login` | `FormData: password` | 302 redirect или 200 — устанавливает cookie `dash_auth` |

Для студента: в данный момент логин просто перенаправляет на `/dashboard`. Когда будет готов student endpoint — добавь его в `loginStudent()` в `src/lib/api.ts`.

### Студенты (требуют cookie `dash_auth`)

| Функция | Метод | Endpoint | Описание |
|---------|-------|----------|----------|
| `getStudents()` | GET | `/api/students` | Список всех студентов |
| `getStudent(alias)` | GET | `/student/:alias` | Данные одного студента |
| `editStudent(alias, data)` | POST | `/student/:alias/edit` | Редактировать студента |
| `freeAttempts(alias, lab_id, task_id)` | POST | `/student/:alias/attempts/free` | Сбросить попытки |
| `markDone(alias, lab_id, task_id)` | POST | `/student/:alias/mark-done` | Пометить выполненным |
| `revertDone(alias, lab_id, task_id)` | POST | `/student/:alias/revert-done` | Отменить выполнение |

### Лабораторные / задания (HTTP Basic auth)

| Функция | Метод | Endpoint | Auth |
|---------|-------|----------|------|
| `getItems(email, password)` | GET | `/api/items` | Basic: email + password |
| `getLogs(email, password, since?, limit?)` | GET | `/api/logs` | Basic: email + password |

### Экспорт и relay

| Функция | Метод | Endpoint |
|---------|-------|----------|
| `exportCsvUrl(lab?)` | — | `/export/csv[?lab=...]` |
| `getRelayStatus(token)` | GET | `/relay/status` (Bearer token) |

---

## Структура страниц

```
/                          — Landing Page
/login                     — Логин (студент / учитель)
/dashboard                 — Главная (role-aware: студент или учитель)
/dashboard/top10           — Рейтинг TOP-10
/dashboard/students        — Список студентов (только учитель)
/dashboard/chat            — Чат (заглушка)
/dashboard/profile         — Профиль (заглушка)
/admin                     — Панель администратора
```

### Переключение роли

Роль сохраняется в `localStorage` под ключом `user_role` (`"student"` | `"teacher"`).

- При логине учителя: `localStorage.setItem("user_role", "teacher")`
- При логине студента: `localStorage.setItem("user_role", "student")`
- Sidebar и страницы читают роль из `localStorage` через `useEffect`

---

## Типы данных (`src/types/index.ts`)

```typescript
// Статус задачи
type TaskStatus = "pass" | "partial" | "fail" | "in_progress" | "pending"

// Студент (из GET /api/students)
interface Student {
  github_alias: string
  email: string
  tg_username?: string
  server_ip?: string
  vm_username?: string
}

// Результат проверки
interface CheckResult {
  lab_id: string
  task_id: string
  status: TaskStatus
  score?: number
  attempts: number
  last_checked?: string
  output?: string
}
```

---

## Деплой (Nginx + Node)

Собери фронт и укажи продакшн URL:

```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=https://api.your-domain.com

npm run build
npm start          # порт 3000
```

Nginx пример:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Бэкенд запускается отдельно на том же сервере (порт 8000 или любой другой — укажи в `NEXT_PUBLIC_API_URL`).
