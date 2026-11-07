import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api.js';
import type { DashboardStats } from '../types.js';
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  PlusCircle,
  Calendar,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import type { NavTab } from '../components/Sidebar.js';

interface DashboardPageProps {
  onNavigate: (tab: NavTab) => void;
  onOpenMeeting: (meetingId: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  onOpenMeeting,
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.dashboard.getStats();
      setStats(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="h-28 bg-slate-900/60 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-900/40 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center">
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-2xl text-sm mb-4">
          {error || 'Unable to load dashboard data.'}
        </div>
        <button
          onClick={fetchStats}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl"
        >
          Retry
        </button>
      </div>
    );
  }

  const isBrandNewUser = stats.totalMeetings === 0 && stats.totalTasks === 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {stats.waitingReviewCount > 0 && (
        <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {stats.waitingReviewCount} AI {stats.waitingReviewCount === 1 ? 'task is' : 'tasks are'} waiting for your review
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Review proposed action items to confirm or reject them before they enter your Task Manager.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (stats.recentMeetings.length > 0) {
                onOpenMeeting(stats.recentMeetings[0].id);
              } else {
                onNavigate('meeting-history');
              }
            }}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300 active:scale-95 rounded-xl shadow-md transition-all shrink-0 whitespace-nowrap"
          >
            <span>Review Tasks</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-xl bg-[#0E1524] border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Total Meetings</span>
            <FileText className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white tabular-nums">{stats.totalMeetings}</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Transcripts processed</span>
        </div>

        <div className="p-4 rounded-xl bg-[#0E1524] border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Confirmed Tasks</span>
            <CheckCircle2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white tabular-nums">{stats.totalTasks}</div>
          <span className="text-[11px] text-slate-500 mt-1 block">In task manager</span>
        </div>

        <div className="p-4 rounded-xl bg-[#0E1524] border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Pending Tasks</span>
            <Clock className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-white tabular-nums">{stats.pendingTasks}</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Pending &amp; In progress</span>
        </div>

        <div className="p-4 rounded-xl bg-[#0E1524] border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 tabular-nums">{stats.completedTasks}</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Done and closed</span>
        </div>

        <div className="p-4 rounded-xl bg-[#0E1524] border border-slate-800/80 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Overdue</span>
            <AlertTriangle className={`w-4 h-4 ${stats.overdueCount > 0 ? 'text-rose-400' : 'text-slate-500'}`} />
          </div>
          <div className={`text-2xl font-bold tabular-nums ${stats.overdueCount > 0 ? 'text-rose-400' : 'text-white'}`}>
            {stats.overdueCount}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Open past deadline</span>
        </div>
      </div>

      {isBrandNewUser ? (
        <div className="p-8 sm:p-12 rounded-2xl bg-[#0E1524] border border-slate-800 text-center max-w-2xl mx-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto shadow-inner">
            <Sparkles className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Welcome to Meeting-to-Action AI</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            Provide a meeting recording link or paste your transcript. Gemini will extract verified action items, decisions, and trackable tasks.
          </p>
          <div className="pt-2">
            <button
              onClick={() => onNavigate('new-meeting')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-600/25 active:scale-98 transition-all"
            >
              <PlusCircle className="w-5 h-5" />
              <span>Create New Meeting</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-5 rounded-2xl bg-[#0E1524] border border-slate-800/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/60">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-bold text-white">Upcoming Deadlines</h3>
                </div>
                <button
                  onClick={() => onNavigate('task-manager')}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
                >
                  View all tasks <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {stats.upcomingDeadlines.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">No upcoming deadlines on open tasks.</div>
              ) : (
                <div className="space-y-2.5">
                  {stats.upcomingDeadlines.map((task) => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const isOverdue = task.deadline! < todayStr;
                    const isToday = task.deadline === todayStr;

                    return (
                      <div
                        key={task.id}
                        className="p-3 rounded-xl bg-[#090D16] border border-slate-800/60 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-white truncate">{task.description}</p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                            <span>{task.assignee || 'Unassigned'}</span>
                            {task.meetingTitle && (
                              <>
                                <span>·</span>
                                <span className="truncate max-w-[150px]">{task.meetingTitle}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span
                            className={`text-xs font-mono font-semibold block ${
                              isOverdue ? 'text-rose-400' : isToday ? 'text-amber-400' : 'text-slate-300'
                            }`}
                          >
                            {task.deadline}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#0E1524] border border-slate-800/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/60">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">Recent Meetings</h3>
                </div>
                <button
                  onClick={() => onNavigate('meeting-history')}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
                >
                  View archive <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {stats.recentMeetings.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">No meetings recorded yet.</div>
              ) : (
                <div className="space-y-2.5">
                  {stats.recentMeetings.map((meeting) => (
                    <div
                      key={meeting.id}
                      onClick={() => onOpenMeeting(meeting.id)}
                      className="p-3 rounded-xl bg-[#090D16] border border-slate-800/60 hover:border-slate-700 cursor-pointer transition-all flex items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white group-hover:text-blue-400 transition-colors truncate">
                          {meeting.title}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                          <span className="font-mono">{meeting.date}</span>
                          <span>·</span>
                          <span>{meeting.participants.length} participants</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs text-emerald-400 font-medium capitalize">{meeting.analysisStatus}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
