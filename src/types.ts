export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface DiscussionPoint {
  topic: string;
  detail: string | null;
}

export interface DecisionItem {
  decision: string;
  evidence: string | null;
}

export interface ExtractedTask {
  id?: string;
  description: string;
  owner: string | null;
  deadline_text: string | null;
  deadline_date: string | null; // YYYY-MM-DD
  evidence: string | null;
  needs_review: boolean;
  review_reasons: string[];
  confirmation_status?: 'proposed' | 'confirmed' | 'rejected';
}

export interface MissingInfoItem {
  type: 'missing_owner' | 'missing_deadline' | 'unclear_responsibility' | 'incomplete_commitment';
  task_description: string | null;
  detail: string;
}

export interface UnresolvedQuestion {
  question: string;
  context: string | null;
}

export interface ConflictItem {
  description: string;
  evidence: string[];
}

export interface FullAnalysis {
  summary: string;
  discussion_points: DiscussionPoint[];
  decisions: DecisionItem[];
  tasks: ExtractedTask[];
  missing_information: MissingInfoItem[];
  unresolved_questions: UnresolvedQuestion[];
  conflicts: ConflictItem[];
}

export interface Meeting {
  id: string;
  userId: string;
  title: string;
  date: string; // YYYY-MM-DD
  participants: string[];
  notes: string | null;
  transcript: string;
  summary: string | null;
  fullAnalysis: FullAnalysis | null;
  analysisStatus: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage: string | null;
  modelName: string | null;
  meetingUrl: string | null;
  meetingPlatform: 'google_meet' | 'zoom' | 'microsoft_teams' | 'other' | null;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed';
export type TaskConfirmationStatus = 'proposed' | 'confirmed' | 'rejected';
export type TaskSource = 'ai' | 'manual';

export interface Task {
  id: string;
  userId: string;
  meetingId: string | null;
  meetingTitle: string | null;
  description: string;
  assignee: string | null;
  deadline: string | null; // YYYY-MM-DD
  deadlineText: string | null;
  status: TaskStatus;
  confirmationStatus: TaskConfirmationStatus;
  source: TaskSource;
  needsReview: boolean;
  reviewReasons: string[];
  evidenceExcerpt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalMeetings: number;
  totalTasks: number; // confirmed tasks
  pendingTasks: number; // pending + in_progress
  completedTasks: number;
  overdueCount: number;
  waitingReviewCount: number; // tasks proposed & needing review from all meetings
  upcomingDeadlines: Task[];
  recentMeetings: Meeting[];
  recentTasks: Task[];
}
