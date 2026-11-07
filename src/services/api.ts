import type {
  User,
  Meeting,
  Task,
  DashboardStats,
  TaskStatus,
} from '../types.js';

const TOKEN_KEY = 'm2a_auth_token';

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  remove: () => localStorage.removeItem(TOKEN_KEY),
};

let onUnauthorizedCallback: (() => void) | null = null;

export function setOnUnauthorized(cb: () => void) {
  onUnauthorizedCallback = cb;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStorage.get();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    tokenStorage.remove();
    if (onUnauthorizedCallback) {
      onUnauthorizedCallback();
    }
    const err = new Error('Your session has expired or is invalid. Please log in again.') as Error & { status: number; data?: any };
    err.status = 401;
    throw err;
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    const errorMsg = data?.error || res.statusText || 'Request failed';
    const err = new Error(errorMsg) as Error & { status: number; data?: any };
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data as T;
}

export const api = {
  auth: {
    register: (name: string, email: string, password: string) =>
      request<{ user: User; token: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      }),
    login: (email: string, password: string) =>
      request<{ user: User; token: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    me: () => request<{ user: User }>('/api/auth/me'),
    logout: () =>
      request<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),
  },

  config: {
    getGeminiStatus: () =>
      request<{ isConfigured: boolean }>('/api/config/gemini-status'),
  },

  dashboard: {
    getStats: () => request<DashboardStats>('/api/dashboard/stats'),
  },

  meetings: {
    list: () =>
      request<
        Array<
          Meeting & {
            tasksCount: number;
            needingReviewCount: number;
            decisionsCount: number;
          }
        >
      >('/api/meetings'),
    get: (id: string) =>
      request<{ meeting: Meeting; tasks: Task[] }>(`/api/meetings/${id}`),
    create: (data: {
      title: string;
      date: string;
      participants: string[];
      notes?: string | null;
      transcript?: string;
      meetingUrl?: string | null;
      meetingPlatform?: string | null;
    }) =>
      request<Meeting>('/api/meetings', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    fetchLink: (data: {
      meetingUrl: string;
      meetingPlatform: string;
      title?: string;
      date?: string;
      participants?: string[];
    }) =>
      request<Meeting>('/api/meetings/fetch-link', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    analyze: (id: string) =>
      request<{ meeting: Meeting; tasks: Task[] }>(`/api/meetings/${id}/analyze`, {
        method: 'POST',
      }),
    delete: (id: string) =>
      request<{ success: boolean; message: string }>(`/api/meetings/${id}`, {
        method: 'DELETE',
      }),
    bulkConfirmReady: (id: string) =>
      request<{ confirmedCount: number; tasks: Task[] }>(
        `/api/meetings/${id}/tasks/bulk-confirm`,
        { method: 'POST' }
      ),
  },

  tasks: {
    list: (confirmedOnly = true) =>
      request<Task[]>(`/api/tasks?confirmedOnly=${confirmedOnly}`),
    createManual: (data: {
      description: string;
      assignee?: string | null;
      deadline?: string | null;
      deadlineText?: string | null;
      status?: TaskStatus;
      meetingId?: string | null;
    }) =>
      request<Task>('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    create: (data: {
      description: string;
      assignee?: string | null;
      deadline?: string | null;
      deadlineText?: string | null;
      status?: TaskStatus;
      meetingId?: string | null;
    }) =>
      request<Task>('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, updates: Partial<Task>) =>
      request<Task>(`/api/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/api/tasks/${id}`, { method: 'DELETE' }),
    confirm: (id: string) =>
      request<Task>(`/api/tasks/${id}/confirm`, { method: 'POST' }),
    reject: (id: string) =>
      request<Task>(`/api/tasks/${id}/reject`, { method: 'POST' }),
    restore: (id: string) =>
      request<Task>(`/api/tasks/${id}/restore`, { method: 'POST' }),
  },
};

export function cleanSubtitleFile(text: string): string {
  const lines = text.split(/\r?\n/);
  const cleaned: string[] = [];

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('WEBVTT') || trimmed.startsWith('NOTE')) continue;
    if (/^\d+$/.test(trimmed)) continue;
    if (/\d{2}:\d{2}.*-->.*\d{2}:\d{2}/.test(trimmed)) continue;
    const cleanText = trimmed.replace(/<[^>]*>/g, '').trim();
    if (cleanText) {
      cleaned.push(cleanText);
    }
  }

  return cleaned.join('\n');
}
