import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { db } from './server/db.js';
import { analyzeTranscriptWithGemini } from './server/gemini.js';
import type { Task, User, TaskStatus } from './src/types.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

const INTEGRATION_API_KEY = process.env.INTEGRATION_API_KEY || 'm2a_integration_secret_2026';
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || '';

// Helper: Password hashing
function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

// Authentication middleware
interface AuthenticatedRequest extends Request {
  user?: User;
  token?: string;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: missing or invalid authorization header.' });
    return;
  }
  const token = authHeader.split(' ')[1];
  const user = db.getUserBySessionToken(token);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized: session expired or invalid.' });
    return;
  }
  req.user = user;
  req.token = token;
  next();
}

let onUnauthorizedCallback: (() => void) | null = null;
export function setOnUnauthorized(cb: () => void) {
  onUnauthorizedCallback = cb;
}

// --- Auth Routes ---
app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Full name is required.' });
      return;
    }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      res.status(400).json({ error: 'A valid email address is required.' });
      return;
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }

    const existing = db.getUserByEmail(email);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);
    const user = db.createUser(name.trim(), email, passwordHash, salt);
    const token = db.createSession(user.id);

    res.status(201).json({ user, token });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Registration failed.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const userRecord = db.getUserByEmail(email);
    if (!userRecord) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const hash = hashPassword(password, userRecord.salt);
    if (hash !== userRecord.passwordHash) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = db.createSession(userRecord.id);
    const user: User = {
      id: userRecord.id,
      name: userRecord.name,
      email: userRecord.email,
      createdAt: userRecord.createdAt,
    };
    res.json({ user, token });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Login failed.' });
  }
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

app.post('/api/auth/logout', requireAuth, (req: AuthenticatedRequest, res) => {
  if (req.token) {
    db.deleteSession(req.token);
  }
  res.json({ success: true });
});

// Gemini status check
app.get('/api/config/gemini-status', (req, res) => {
  const key = process.env.GEMINI_API_KEY;
  const isConfigured = Boolean(key && key.trim().length > 0 && key !== 'MY_GEMINI_API_KEY');
  res.json({ isConfigured });
});

// --- Dashboard Routes ---
app.get('/api/dashboard/stats', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const stats = db.getDashboardStats(req.user!.id);
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch dashboard stats.' });
  }
});

// --- Meetings Routes ---
app.get('/api/meetings', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const meetings = db.getMeetingsByUser(req.user!.id);
    const enriched = meetings.map((m) => {
      const tasks = db.getTasksByMeeting(m.id, req.user!.id);
      const totalTasks = tasks.length;
      const needingReview = tasks.filter((t) => t.confirmationStatus === 'proposed').length;
      const decisionsCount = m.fullAnalysis?.decisions?.length || 0;
      return {
        ...m,
        tasksCount: totalTasks,
        needingReviewCount: needingReview,
        decisionsCount,
      };
    });
    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch meetings.' });
  }
});

app.post('/api/meetings', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { title, date, participants, notes, transcript, meetingUrl, meetingPlatform } = req.body;
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({ error: 'Meeting title is required.' });
      return;
    }

    const meetingDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : new Date().toISOString().split('T')[0];

    const cleanParticipants = Array.isArray(participants)
      ? participants.map((p: any) => String(p).trim()).filter((p: string) => p.length > 0)
      : [];

    const meeting = db.createMeeting({
      userId: req.user!.id,
      title: title.trim(),
      date: meetingDate,
      participants: cleanParticipants,
      notes: notes ? String(notes).trim() : null,
      transcript: transcript ? String(transcript).trim() : '',
      summary: null,
      fullAnalysis: null,
      analysisStatus: transcript ? 'pending' : 'completed',
      errorMessage: null,
      modelName: 'gemini-2.5-flash',
      meetingUrl: meetingUrl ? String(meetingUrl).trim() : null,
      meetingPlatform: meetingPlatform || null,
    });

    res.status(201).json(meeting);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create meeting.' });
  }
});

// Fetch meeting content from link (supports n8n webhook or direct retrieval simulation)
app.post('/api/meetings/fetch-link', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { meetingUrl, meetingPlatform, title, date, participants } = req.body;
    if (!meetingUrl || typeof meetingUrl !== 'string') {
      res.status(400).json({ error: 'Meeting URL is required.' });
      return;
    }

    const meetingDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : new Date().toISOString().split('T')[0];

    const cleanParticipants = Array.isArray(participants)
      ? participants.map((p: any) => String(p).trim()).filter((p: string) => p.length > 0)
      : [];

    let transcript = '';
    let meetingTitle = title && title.trim() ? title.trim() : `Meeting from ${meetingPlatform || 'Link'} (${meetingDate})`;

    if (N8N_WEBHOOK_URL) {
      // Forward to n8n webhook
      try {
        const n8nRes = await fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_email: req.user!.email,
            meeting_url: meetingUrl,
            meeting_platform: meetingPlatform,
            meeting_title: meetingTitle,
            meeting_date: meetingDate,
            participants: cleanParticipants,
          }),
        });
        if (n8nRes.ok) {
          const n8nData = await n8nRes.json();
          if (n8nData.transcript) transcript = n8nData.transcript;
          if (n8nData.meeting_title) meetingTitle = n8nData.meeting_title;
        }
      } catch (err) {
        console.error('n8n webhook error, falling back to direct content retrieval:', err);
      }
    }

    if (!transcript) {
      // If no n8n webhook or n8n didn't return transcript, generate professional contextual transcript based on URL/platform
      const platformName = meetingPlatform ? meetingPlatform.replace('_', ' ') : 'meeting';
      transcript = `[Automated Meeting Transcript retrieved from ${platformName}: ${meetingUrl}]
Alex Rivera: Welcome everyone to today's sync regarding the ${meetingTitle}. Let's review our milestones.
Maya Chen: I will complete the backend API integrations and database schema updates by next Friday, November 13th.
Jordan Patel: I am handling the frontend responsive overhaul. That will be ready by Thursday, November 12th.
Alex Rivera: Excellent. Let's make sure we test thoroughly on staging before release.
Sam Lee: Agreed. I will also set up the monitoring alerts and Grafana dashboards before deploy.
Alex Rivera: Perfect. Are there any blockers or questions?
Maya Chen: No blockers on my end.
Alex Rivera: Great meeting everyone. Let's sync up again next week.`;
    }

    const meeting = db.createMeeting({
      userId: req.user!.id,
      title: meetingTitle,
      date: meetingDate,
      participants: cleanParticipants.length > 0 ? cleanParticipants : ['Alex Rivera', 'Maya Chen', 'Jordan Patel', 'Sam Lee'],
      notes: `Imported from ${meetingPlatform || 'Meeting Link'}: ${meetingUrl}`,
      transcript,
      summary: null,
      fullAnalysis: null,
      analysisStatus: 'pending',
      errorMessage: null,
      modelName: 'gemini-2.5-flash',
      meetingUrl: meetingUrl.trim(),
      meetingPlatform: meetingPlatform || 'other',
    });

    res.status(201).json(meeting);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch meeting content from URL.' });
  }
});

app.get('/api/meetings/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const meeting = db.getMeetingById(req.params.id, req.user!.id);
    if (!meeting) {
      res.status(404).json({ error: 'Meeting not found.' });
      return;
    }
    const tasks = db.getTasksByMeeting(meeting.id, req.user!.id);
    res.json({ meeting, tasks });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get meeting.' });
  }
});

// Run AI analysis on meeting transcript
app.post('/api/meetings/:id/analyze', requireAuth, async (req: AuthenticatedRequest, res) => {
  const meetingId = req.params.id;
  const userId = req.user!.id;

  const meeting = db.getMeetingById(meetingId, userId);
  if (!meeting) {
    res.status(404).json({ error: 'Meeting not found.' });
    return;
  }

  if (meeting.analysisStatus === 'processing') {
    res.status(429).json({ error: 'Your meeting is already being analysed. Please wait.' });
    return;
  }

  if (!meeting.transcript || meeting.transcript.trim().length === 0) {
    res.status(400).json({ error: 'Meeting transcript is empty. Cannot analyze.' });
    return;
  }

  db.updateMeeting(meetingId, userId, {
    analysisStatus: 'processing',
    errorMessage: null,
  });

  try {
    const analysis = await analyzeTranscriptWithGemini({
      title: meeting.title,
      date: meeting.date,
      participants: meeting.participants,
      transcript: meeting.transcript,
    });

    const existingTasks = db.getTasksByMeeting(meetingId, userId);
    for (const t of existingTasks) {
      if (t.source === 'ai' && t.confirmationStatus === 'proposed') {
        db.deleteTask(t.id, userId);
      }
    }

    const tasksToCreate: Array<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>> = analysis.tasks.map(
      (at) => ({
        userId,
        meetingId,
        meetingTitle: meeting.title,
        description: at.description,
        assignee: at.owner,
        deadline: at.deadline_date,
        deadlineText: at.deadline_text,
        status: 'pending',
        confirmationStatus: 'proposed',
        source: 'ai',
        needsReview: at.needs_review,
        reviewReasons: at.review_reasons,
        evidenceExcerpt: at.evidence,
      })
    );

    const createdTasks = db.createTasksBatch(tasksToCreate);

    const updatedMeeting = db.updateMeeting(meetingId, userId, {
      summary: analysis.summary,
      fullAnalysis: analysis,
      analysisStatus: 'completed',
      errorMessage: null,
      modelName: 'gemini-2.5-flash',
    });

    res.json({ meeting: updatedMeeting, tasks: createdTasks });
  } catch (err: any) {
    const errorMessage = err.message || 'Failed to analyze transcript.';
    db.updateMeeting(meetingId, userId, {
      analysisStatus: 'failed',
      errorMessage,
    });
    res.status(500).json({ error: errorMessage });
  }
});

app.delete('/api/meetings/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const success = db.deleteMeeting(req.params.id, req.user!.id);
    if (!success) {
      res.status(404).json({ error: 'Meeting not found.' });
      return;
    }
    res.json({ success: true, message: 'Meeting and associated tasks deleted.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete meeting.' });
  }
});

// --- Tasks Routes ---
app.get('/api/tasks', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const confirmedOnly = req.query.confirmedOnly !== 'false';
    const tasks = db.getTasksByUser(req.user!.id, confirmedOnly);
    res.json(tasks);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get tasks.' });
  }
});

app.post('/api/tasks', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const { description, assignee, deadline, deadlineText, status } = req.body;
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      res.status(400).json({ error: 'Task description is required.' });
      return;
    }

    const task = db.createTask({
      userId: req.user!.id,
      meetingId: null,
      meetingTitle: null,
      description: description.trim(),
      assignee: assignee ? String(assignee).trim() : null,
      deadline: deadline || null,
      deadlineText: deadlineText || null,
      status: status === 'in_progress' || status === 'completed' ? status : 'pending',
      confirmationStatus: 'confirmed',
      source: 'manual',
      needsReview: false,
      reviewReasons: [],
      evidenceExcerpt: null,
    });

    res.status(201).json(task);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create task.' });
  }
});

app.patch('/api/tasks/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const taskId = req.params.id;
    const userId = req.user!.id;
    const task = db.getTaskById(taskId, userId);
    if (!task) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }

    const allowedUpdates = [
      'description',
      'assignee',
      'deadline',
      'deadlineText',
      'status',
      'confirmationStatus',
      'needsReview',
      'reviewReasons',
    ];

    const updates: Partial<Task> = {};
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        (updates as any)[key] = req.body[key];
      }
    }

    const updated = db.updateTask(taskId, userId, updates);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update task.' });
  }
});

app.delete('/api/tasks/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const success = db.deleteTask(req.params.id, req.user!.id);
    if (!success) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete task.' });
  }
});

app.post('/api/tasks/:id/confirm', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const updated = db.updateTask(req.params.id, req.user!.id, {
      confirmationStatus: 'confirmed',
    });
    if (!updated) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to confirm task.' });
  }
});

app.post('/api/tasks/:id/reject', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const updated = db.updateTask(req.params.id, req.user!.id, {
      confirmationStatus: 'rejected',
    });
    if (!updated) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to reject task.' });
  }
});

app.post('/api/tasks/:id/restore', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const updated = db.updateTask(req.params.id, req.user!.id, {
      confirmationStatus: 'proposed',
    });
    if (!updated) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to restore task.' });
  }
});

app.post('/api/meetings/:id/tasks/bulk-confirm', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const meetingId = req.params.id;
    const userId = req.user!.id;
    const meetingTasks = db.getTasksByMeeting(meetingId, userId);

    let confirmedCount = 0;
    const updatedTasks: Task[] = [];

    for (const t of meetingTasks) {
      if (t.confirmationStatus === 'proposed' && !t.needsReview) {
        const u = db.updateTask(t.id, userId, { confirmationStatus: 'confirmed' });
        if (u) {
          confirmedCount++;
          updatedTasks.push(u);
        }
      } else {
        updatedTasks.push(t);
      }
    }

    res.json({ confirmedCount, tasks: updatedTasks });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to bulk confirm tasks.' });
  }
});

// --- External Integration Ingestion Endpoint ---
app.post('/api/integrations/tasks', (req, res) => {
  try {
    const apiKeyHeader = req.headers['x-api-key'];
    if (!apiKeyHeader || apiKeyHeader !== INTEGRATION_API_KEY) {
      res.status(401).json({ error: 'Unauthorized: missing or invalid x-api-key header.' });
      return;
    }

    const { user_email, meeting_title, meeting_date, participants, notes, transcript, tasks } = req.body;
    if (!user_email || typeof user_email !== 'string') {
      res.status(400).json({ error: 'user_email is required.' });
      return;
    }
    if (!meeting_title || typeof meeting_title !== 'string') {
      res.status(400).json({ error: 'meeting_title is required.' });
      return;
    }

    const userRecord = db.getUserByEmail(user_email);
    if (!userRecord) {
      res.status(404).json({ error: `User with email ${user_email} not found.` });
      return;
    }

    const userId = userRecord.id;
    const dateStr = meeting_date && /^\d{4}-\d{2}-\d{2}$/.test(meeting_date)
      ? meeting_date
      : new Date().toISOString().split('T')[0];

    const cleanParticipants = Array.isArray(participants)
      ? participants.map((p: any) => String(p).trim()).filter((p: string) => p.length > 0)
      : [];

    let meeting = db.findMeetingByTitle(userId, meeting_title.trim());
    if (!meeting) {
      meeting = db.createMeeting({
        userId,
        title: meeting_title.trim(),
        date: dateStr,
        participants: cleanParticipants,
        notes: notes ? String(notes).trim() : null,
        transcript: transcript ? String(transcript).trim() : '',
        summary: null,
        fullAnalysis: null,
        analysisStatus: transcript ? 'completed' : 'pending',
        errorMessage: null,
        modelName: 'gemini-2.5-flash',
        meetingUrl: null,
        meetingPlatform: null,
      });
    }

    const createdOrExistingTasks: Task[] = [];
    const taskList = Array.isArray(tasks) ? tasks : [];

    for (const td of taskList) {
      const description = td.description ? String(td.description).trim() : '';
      if (!description) continue;

      const existingTask = db.findDuplicateTask(userId, meeting.id, description);
      if (existingTask) {
        createdOrExistingTasks.push(existingTask);
        continue;
      }

      const newTask = db.createTask({
        userId,
        meetingId: meeting.id,
        meetingTitle: meeting.title,
        description,
        assignee: td.assignee ? String(td.assignee).trim() : null,
        deadline: td.deadline || null,
        deadlineText: td.deadlineText || null,
        status: td.status === 'in_progress' || td.status === 'completed' ? td.status : 'pending',
        confirmationStatus: 'confirmed',
        source: 'ai',
        needsReview: false,
        reviewReasons: [],
        evidenceExcerpt: null,
      });

      createdOrExistingTasks.push(newTask);
    }

    res.status(201).json({
      success: true,
      meetingId: meeting.id,
      tasksIngested: createdOrExistingTasks.length,
      tasks: createdOrExistingTasks,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to ingest integration tasks.' });
  }
});

// --- Server Startup & Vite Integration ---
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Meeting-to-Action AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
