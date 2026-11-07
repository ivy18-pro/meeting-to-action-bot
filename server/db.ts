import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { User, Meeting, Task, DashboardStats, TaskStatus, TaskConfirmationStatus, TaskSource } from '../src/types.js';

interface UserRecord extends User {
  passwordHash: string;
  salt: string;
}

interface SessionRecord {
  token: string;
  userId: string;
  createdAt: number;
}

interface DatabaseSchema {
  users: Record<string, UserRecord>;
  sessions: Record<string, SessionRecord>;
  meetings: Record<string, Meeting>;
  tasks: Record<string, Task>;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'db.json');

class Database {
  private data: DatabaseSchema = {
    users: {},
    sessions: {},
    meetings: {},
    tasks: {},
  };

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = {
          users: parsed.users || {},
          sessions: parsed.sessions || {},
          meetings: {},
          tasks: {},
        };

        if (parsed.meetings) {
          for (const [id, m] of Object.entries(parsed.meetings) as [string, any][]) {
            this.data.meetings[id] = {
              id: m.id,
              userId: m.userId,
              title: m.title,
              date: m.date || new Date().toISOString().split('T')[0],
              participants: Array.isArray(m.participants) ? m.participants : [],
              notes: m.notes || m.summary || null,
              transcript: m.transcript || '',
              summary: m.summary || null,
              fullAnalysis: m.fullAnalysis || null,
              analysisStatus: m.analysisStatus || (m.transcript ? 'completed' : 'pending'),
              errorMessage: m.errorMessage || null,
              modelName: m.modelName || null,
              meetingUrl: m.meetingUrl || null,
              meetingPlatform: m.meetingPlatform || null,
              createdAt: m.createdAt || new Date().toISOString(),
              updatedAt: m.updatedAt || new Date().toISOString(),
            };
          }
        }

        if (parsed.tasks) {
          for (const [id, t] of Object.entries(parsed.tasks) as [string, any][]) {
            let status: TaskStatus = 'pending';
            if (t.status === 'in_progress' || t.status === 'completed') {
              status = t.status;
            }

            let confirmationStatus: TaskConfirmationStatus = 'confirmed';
            if (t.confirmationStatus === 'proposed' || t.confirmationStatus === 'rejected') {
              confirmationStatus = t.confirmationStatus;
            }

            const source: TaskSource = t.source === 'ai' ? 'ai' : 'manual';

            this.data.tasks[id] = {
              id: t.id,
              userId: t.userId,
              meetingId: t.meetingId || null,
              meetingTitle: t.meetingTitle || null,
              description: t.description || 'Untitled task',
              assignee: t.assignee || null,
              deadline: t.deadline || null,
              deadlineText: t.deadlineText || null,
              status,
              confirmationStatus,
              source,
              needsReview: Boolean(t.needsReview),
              reviewReasons: Array.isArray(t.reviewReasons) ? t.reviewReasons : [],
              evidenceExcerpt: t.evidenceExcerpt || null,
              createdAt: t.createdAt || new Date().toISOString(),
              updatedAt: t.updatedAt || new Date().toISOString(),
            };
          }
        }
      } else {
        this.save();
      }
    } catch (err) {
      console.error('Failed to initialize database, resetting state:', err);
      this.save();
    }
  }

  private save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpFile, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      console.error('Failed to write database file:', err);
    }
  }

  // --- Auth & Users ---
  createUser(name: string, email: string, passwordHash: string, salt: string): User {
    const id = crypto.randomUUID();
    const user: UserRecord = {
      id,
      name,
      email: email.toLowerCase().trim(),
      createdAt: new Date().toISOString(),
      passwordHash,
      salt,
    };
    this.data.users[id] = user;
    this.save();
    return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt };
  }

  getUserByEmail(email: string): UserRecord | null {
    const normalized = email.toLowerCase().trim();
    for (const u of Object.values(this.data.users)) {
      if (u.email === normalized) return u;
    }
    return null;
  }

  getUserById(id: string): User | null {
    const u = this.data.users[id];
    if (!u) return null;
    return { id: u.id, name: u.name, email: u.email, createdAt: u.createdAt };
  }

  createSession(userId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    this.data.sessions[token] = {
      token,
      userId,
      createdAt: Date.now(),
    };
    this.save();
    return token;
  }

  getUserBySessionToken(token: string): User | null {
    const session = this.data.sessions[token];
    if (!session) return null;
    return this.getUserById(session.userId);
  }

  deleteSession(token: string) {
    if (this.data.sessions[token]) {
      delete this.data.sessions[token];
      this.save();
    }
  }

  // --- Meetings ---
  createMeeting(meetingData: Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'>): Meeting {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const meeting: Meeting = {
      ...meetingData,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.data.meetings[id] = meeting;
    this.save();
    return meeting;
  }

  getMeetingById(id: string, userId: string): Meeting | null {
    const m = this.data.meetings[id];
    if (!m || m.userId !== userId) return null;
    return m;
  }

  getMeetingsByUser(userId: string): Meeting[] {
    return Object.values(this.data.meetings)
      .filter((m) => m.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  findRecentDuplicateMeeting(userId: string, title: string, date: string, withinMinutes = 2): Meeting | null {
    const cutoff = Date.now() - withinMinutes * 60 * 1000;
    const cleanTitle = title.trim().toLowerCase();
    for (const m of Object.values(this.data.meetings)) {
      if (
        m.userId === userId &&
        new Date(m.createdAt).getTime() > cutoff &&
        m.title.trim().toLowerCase() === cleanTitle &&
        m.date === date
      ) {
        return m;
      }
    }
    return null;
  }

  findMeetingByTitle(userId: string, title: string): Meeting | null {
    const cleanTitle = title.trim().toLowerCase();
    for (const m of Object.values(this.data.meetings)) {
      if (m.userId === userId && m.title.trim().toLowerCase() === cleanTitle) {
        return m;
      }
    }
    return null;
  }

  updateMeeting(id: string, userId: string, updates: Partial<Meeting>): Meeting | null {
    const m = this.data.meetings[id];
    if (!m || m.userId !== userId) return null;
    const updated: Meeting = {
      ...m,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.data.meetings[id] = updated;

    if (updates.title) {
      for (const [taskId, task] of Object.entries(this.data.tasks)) {
        if (task.meetingId === id) {
          task.meetingTitle = updates.title;
        }
      }
    }

    this.save();
    return updated;
  }

  deleteMeeting(id: string, userId: string): boolean {
    const m = this.data.meetings[id];
    if (!m || m.userId !== userId) return false;
    delete this.data.meetings[id];

    for (const [taskId, task] of Object.entries(this.data.tasks)) {
      if (task.meetingId === id && task.userId === userId) {
        delete this.data.tasks[taskId];
      }
    }
    this.save();
    return true;
  }

  // --- Tasks ---
  createTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Task {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const task: Task = {
      ...taskData,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.data.tasks[id] = task;
    this.save();
    return task;
  }

  createTasksBatch(tasksData: Array<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>): Task[] {
    const created: Task[] = [];
    const now = new Date().toISOString();
    for (const td of tasksData) {
      const id = crypto.randomUUID();
      const task: Task = {
        ...td,
        id,
        createdAt: now,
        updatedAt: now,
      };
      this.data.tasks[id] = task;
      created.push(task);
    }
    this.save();
    return created;
  }

  getTaskById(id: string, userId: string): Task | null {
    const t = this.data.tasks[id];
    if (!t || t.userId !== userId) return null;
    return t;
  }

  getTasksByUser(userId: string, confirmedOnly = false): Task[] {
    return Object.values(this.data.tasks)
      .filter((t) => t.userId === userId && (!confirmedOnly || t.confirmationStatus === 'confirmed'))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getTasksByMeeting(meetingId: string, userId: string): Task[] {
    return Object.values(this.data.tasks).filter(
      (t) => t.userId === userId && t.meetingId === meetingId
    );
  }

  findDuplicateTask(userId: string, meetingId: string, description: string): Task | null {
    const cleanDesc = description.trim().toLowerCase();
    for (const t of Object.values(this.data.tasks)) {
      if (
        t.userId === userId &&
        t.meetingId === meetingId &&
        t.description.trim().toLowerCase() === cleanDesc
      ) {
        return t;
      }
    }
    return null;
  }

  updateTask(id: string, userId: string, updates: Partial<Task>): Task | null {
    const t = this.data.tasks[id];
    if (!t || t.userId !== userId) return null;
    const updated: Task = {
      ...t,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.data.tasks[id] = updated;
    this.save();
    return updated;
  }

  deleteTask(id: string, userId: string): boolean {
    const t = this.data.tasks[id];
    if (!t || t.userId !== userId) return false;
    delete this.data.tasks[id];
    this.save();
    return true;
  }

  // --- Dashboard Stats ---
  getDashboardStats(userId: string): DashboardStats {
    const userMeetings = this.getMeetingsByUser(userId);
    const allUserTasks = Object.values(this.data.tasks).filter((t) => t.userId === userId);
    const confirmedTasks = allUserTasks.filter((t) => t.confirmationStatus === 'confirmed');

    const totalMeetings = userMeetings.length;
    const totalTasks = confirmedTasks.length;

    let pendingTasks = 0;
    let completedTasks = 0;
    let overdueCount = 0;

    const todayStr = new Date().toISOString().split('T')[0];

    for (const t of confirmedTasks) {
      if (t.status === 'completed') {
        completedTasks++;
      } else {
        pendingTasks++;
        if (t.deadline && t.deadline < todayStr) {
          overdueCount++;
        }
      }
    }

    const waitingReviewCount = allUserTasks.filter(
      (t) => t.confirmationStatus === 'proposed'
    ).length;

    const upcomingDeadlines = confirmedTasks
      .filter((t) => t.status !== 'completed' && t.deadline !== null)
      .sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1))
      .slice(0, 5);

    const recentMeetings = userMeetings.slice(0, 5);
    const recentTasks = confirmedTasks.slice(0, 5);

    return {
      totalMeetings,
      totalTasks,
      pendingTasks,
      completedTasks,
      overdueCount,
      waitingReviewCount,
      upcomingDeadlines,
      recentMeetings,
      recentTasks,
    };
  }
}

export const db = new Database();
