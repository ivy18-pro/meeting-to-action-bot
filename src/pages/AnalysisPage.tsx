import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api.js';
import type { Meeting, Task } from '../types.js';
import {
  Sparkles,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Edit2,
  Calendar,
  User as UserIcon,
  Quote,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  AlertTriangle,
  ArrowLeft,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import { useToast } from '../context/ToastContext.js';

interface AnalysisPageProps {
  meetingId: string;
  onBack: () => void;
  onNavigateToTasks: () => void;
}

export const AnalysisPage: React.FC<AnalysisPageProps> = ({
  meetingId,
  onBack,
  onNavigateToTasks,
}) => {
  const { showToast } = useToast();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editDeadlineText, setEditDeadlineText] = useState('');

  const fetchMeeting = useCallback(async (autoAnalyzeIfPending = true) => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.meetings.get(meetingId);
      setMeeting(data.meeting);
      setTasks(data.tasks);

      if (
        autoAnalyzeIfPending &&
        data.meeting.transcript &&
        (data.meeting.analysisStatus === 'pending' || data.meeting.analysisStatus === 'processing') &&
        !data.meeting.fullAnalysis
      ) {
        runAnalysis();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load meeting details.');
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      showToast('Gemini is analyzing meeting conversation...', 'info');
      const result = await api.meetings.analyze(meetingId);
      setMeeting(result.meeting);
      setTasks(result.tasks);
      showToast('Meeting analysis complete!', 'success');
    } catch (err: any) {
      setError(err?.message || 'AI analysis failed.');
      showToast('Analysis encountered an issue.', 'error');
      const data = await api.meetings.get(meetingId);
      setMeeting(data.meeting);
      setTasks(data.tasks);
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    fetchMeeting(true);
  }, [fetchMeeting]);

  const handleConfirmTask = async (taskId: string) => {
    try {
      const updated = await api.tasks.confirm(taskId);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      showToast('Task confirmed and added to Task Manager.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to confirm task.', 'error');
    }
  };

  const handleRejectTask = async (taskId: string) => {
    try {
      const updated = await api.tasks.reject(taskId);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      showToast('Task rejected.', 'info');
    } catch (err: any) {
      showToast(err?.message || 'Failed to reject task.', 'error');
    }
  };

  const handleRestoreTask = async (taskId: string) => {
    try {
      const updated = await api.tasks.restore(taskId);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      showToast('Task restored to review state.', 'info');
    } catch (err: any) {
      showToast(err?.message || 'Failed to restore task.', 'error');
    }
  };

  const handleBulkConfirmReady = async () => {
    try {
      const res = await api.meetings.bulkConfirmReady(meetingId);
      setTasks(res.tasks);
      showToast(`Confirmed ${res.confirmedCount} ready unflagged tasks!`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to bulk confirm tasks.', 'error');
    }
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setEditDescription(task.description);
    setEditAssignee(task.assignee || '');
    setEditDeadline(task.deadline || '');
    setEditDeadlineText(task.deadlineText || '');
  };

  const handleSaveEdit = async () => {
    if (!editingTask) return;
    if (!editDescription.trim()) {
      showToast('Task description cannot be empty.', 'error');
      return;
    }

    try {
      const updated = await api.tasks.update(editingTask.id, {
        description: editDescription.trim(),
        assignee: editAssignee.trim() || null,
        deadline: editDeadline || null,
        deadlineText: editDeadlineText.trim() || null,
        needsReview: false,
        reviewReasons: [],
      });
      setTasks((prev) => prev.map((t) => (t.id === editingTask.id ? updated : t)));
      setEditingTask(null);
      showToast('Task updated and verified.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to update task.', 'error');
    }
  };

  const copyTranscript = () => {
    if (meeting?.transcript) {
      navigator.clipboard.writeText(meeting.transcript);
      setCopiedTranscript(true);
      setTimeout(() => setCopiedTranscript(false), 2000);
      showToast('Transcript copied to clipboard.', 'info');
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-6">
        <div className="h-20 bg-slate-900/60 rounded-2xl animate-pulse" />
        <div className="h-40 bg-slate-900/40 rounded-2xl animate-pulse" />
        <div className="h-64 bg-slate-900/40 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <p className="text-slate-400 text-sm">Meeting not found.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const analysis = meeting.fullAnalysis;
  const isProcessing = analyzing || meeting.analysisStatus === 'processing' || meeting.analysisStatus === 'pending';
  const isFailed = meeting.analysisStatus === 'failed';

  const unflaggedProposedCount = tasks.filter(
    (t) => t.confirmationStatus === 'proposed' && !t.needsReview
  ).length;

  const confirmedCount = tasks.filter((t) => t.confirmationStatus === 'confirmed').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Meetings</span>
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {meeting.title}
            </h1>
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-lg border ${
                meeting.analysisStatus === 'completed'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : isFailed
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
              }`}
            >
              {isProcessing ? 'Analyzing with Gemini...' : meeting.analysisStatus.toUpperCase()}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-2">
            <span className="font-mono text-slate-300">{meeting.date}</span>
            <span>·</span>
            <span>
              {meeting.participants.length > 0
                ? meeting.participants.join(', ')
                : 'No participants recorded'}
            </span>
            {meeting.meetingUrl && (
              <>
                <span>·</span>
                <a
                  href={meeting.meetingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>{meeting.meetingPlatform || 'Meeting Link'}</span>
                </a>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto shrink-0">
          {confirmedCount > 0 && (
            <button
              onClick={onNavigateToTasks}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-slate-700"
            >
              <span>View in Task Manager ({confirmedCount})</span>
            </button>
          )}

          <button
            onClick={runAnalysis}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:scale-95 rounded-xl shadow-md shadow-blue-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
            <span>{isFailed ? 'Retry Analysis' : 'Re-run Analysis'}</span>
          </button>
        </div>
      </div>

      {isProcessing && (
        <div className="p-8 rounded-2xl bg-gradient-to-br from-blue-950/40 via-indigo-950/20 to-[#0E1524] border border-blue-500/30 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto animate-bounce">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Gemini 3.8 Flash Analysis in Progress</h3>
            <p className="text-xs text-slate-300 max-w-md mx-auto mt-1">
              Extracting key decisions, parsing verified action items, cross-referencing deadlines, and auditing uncertainties...
            </p>
          </div>
          <div className="w-48 h-1.5 bg-slate-800 rounded-full mx-auto overflow-hidden">
            <div className="w-full h-full bg-blue-500 animate-[pulse_1s_ease-in-out_infinite]" />
          </div>
        </div>
      )}

      {isFailed && (
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-white">Analysis Failed</h3>
              <p className="text-xs mt-1 text-rose-200 leading-relaxed">
                {meeting.errorMessage || error || 'An error occurred during Gemini analysis.'}
              </p>
            </div>
          </div>
          <div className="pt-2">
            <button
              onClick={runAnalysis}
              className="px-4 py-2 text-xs font-semibold text-slate-900 bg-rose-300 hover:bg-rose-200 rounded-xl transition-all"
            >
              Retry Analysis
            </button>
          </div>
        </div>
      )}

      {meeting.analysisStatus === 'completed' && analysis && (
        <div className="space-y-8">
          {/* Section 1: Summary */}
          <section className="p-5 sm:p-6 rounded-2xl bg-[#0E1524] border border-slate-800/80 space-y-3">
            <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs tracking-wider uppercase">
              <Sparkles className="w-4 h-4" />
              <span>Meeting Summary</span>
            </div>
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-normal">
              {analysis.summary}
            </p>
          </section>

          {/* Section 2 & 3: Discussions & Decisions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="p-5 sm:p-6 rounded-2xl bg-[#0E1524] border border-slate-800/80 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <span>Discussion Points</span>
                  <span className="text-xs text-slate-400 font-normal">
                    ({analysis.discussion_points.length})
                  </span>
                </h3>
                {analysis.discussion_points.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4">No key discussion points identified.</p>
                ) : (
                  <ul className="space-y-3">
                    {analysis.discussion_points.map((dp, idx) => (
                      <li key={idx} className="p-3 rounded-xl bg-[#090D16] border border-slate-800/60 text-xs">
                        <span className="font-semibold text-slate-100 block">{dp.topic}</span>
                        {dp.detail && (
                          <span className="text-slate-400 mt-1 block leading-relaxed">{dp.detail}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="p-5 sm:p-6 rounded-2xl bg-[#0E1524] border border-slate-800/80 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <span>Decisions Made</span>
                  <span className="text-xs text-slate-400 font-normal">
                    ({analysis.decisions.length})
                  </span>
                </h3>
                {analysis.decisions.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4">No binding decisions agreed upon.</p>
                ) : (
                  <ul className="space-y-3">
                    {analysis.decisions.map((dec, idx) => (
                      <li key={idx} className="p-3 rounded-xl bg-[#090D16] border border-slate-800/60 text-xs space-y-2">
                        <div className="font-semibold text-emerald-300 flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{dec.decision}</span>
                        </div>
                        {dec.evidence && (
                          <div className="flex items-start gap-2 pl-6 text-[11px] text-slate-400 italic">
                            <Quote className="w-3 h-3 text-slate-500 shrink-0 mt-0.5" />
                            <span>"{dec.evidence}"</span>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>

          {/* Section 4: Action Items Table */}
          <section className="p-5 sm:p-6 rounded-2xl bg-[#0E1524] border border-slate-800/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/60">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Action Items &amp; Task Proposals</span>
                  <span className="text-xs text-slate-400 font-normal">({tasks.length})</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Confirm valid tasks to save them into your Task Manager. Flagged items require review before confirmation.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleBulkConfirmReady}
                  disabled={unflaggedProposedCount === 0}
                  className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-slate-900 bg-emerald-400 hover:bg-emerald-300 active:scale-95 rounded-xl shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirm all ready ({unflaggedProposedCount})</span>
                </button>
              </div>
            </div>

            {tasks.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No actionable tasks detected.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-medium">
                      <th className="py-3 px-3">Description</th>
                      <th className="py-3 px-3">Owner</th>
                      <th className="py-3 px-3">Deadline</th>
                      <th className="py-3 px-3">Supporting Excerpt</th>
                      <th className="py-3 px-3">Review Status</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {tasks.map((task) => {
                      const isFlagged = task.needsReview;
                      const status = task.confirmationStatus;

                      return (
                        <tr
                          key={task.id}
                          className={`group hover:bg-slate-900/40 transition-colors ${
                            isFlagged && status === 'proposed'
                              ? 'bg-amber-500/5'
                              : status === 'confirmed'
                              ? 'bg-emerald-500/5'
                              : status === 'rejected'
                              ? 'opacity-60 bg-slate-950/40'
                              : ''
                          }`}
                        >
                          <td className="py-3.5 px-3 align-top max-w-xs">
                            <span className="font-semibold text-white block">{task.description}</span>
                            {isFlagged && task.reviewReasons.length > 0 && (
                              <div className="mt-1.5 space-y-1">
                                {task.reviewReasons.map((reason, i) => (
                                  <div key={i} className="flex items-center gap-1.5 text-[11px] text-amber-300 font-medium">
                                    <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                                    <span>{reason}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-3 align-top whitespace-nowrap">
                            {task.assignee ? (
                              <div className="flex items-center gap-1.5 text-slate-200">
                                <UserIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                <span className="font-medium">{task.assignee}</span>
                              </div>
                            ) : (
                              <span className="text-amber-400 font-medium">Unassigned</span>
                            )}
                          </td>

                          <td className="py-3.5 px-3 align-top whitespace-nowrap">
                            {task.deadline ? (
                              <div>
                                <span className="font-mono font-semibold text-slate-200 block">{task.deadline}</span>
                                {task.deadlineText && (
                                  <span className="text-[10px] text-slate-400">"{task.deadlineText}"</span>
                                )}
                              </div>
                            ) : task.deadlineText ? (
                              <span className="text-amber-300 font-mono text-[11px]">"{task.deadlineText}"</span>
                            ) : (
                              <span className="text-amber-400 font-medium">No deadline</span>
                            )}
                          </td>

                          <td className="py-3.5 px-3 align-top max-w-xs text-slate-400 italic text-[11px]">
                            {task.evidenceExcerpt ? `"${task.evidenceExcerpt}"` : <span className="text-slate-600 not-italic">None</span>}
                          </td>

                          <td className="py-3.5 px-3 align-top whitespace-nowrap">
                            <span className={`text-[11px] font-semibold uppercase tracking-wider block ${
                              status === 'confirmed' ? 'text-emerald-400' : status === 'rejected' ? 'text-rose-400' : 'text-amber-400'
                            }`}>
                              {status}
                            </span>
                          </td>

                          <td className="py-3.5 px-3 align-top text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openEditModal(task)}
                                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                                title="Edit task"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {status !== 'confirmed' && (
                                <button
                                  onClick={() => handleConfirmTask(task.id)}
                                  className="px-2.5 py-1 text-xs font-semibold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-lg transition-all"
                                >
                                  Confirm
                                </button>
                              )}
                              {status !== 'rejected' && (
                                <button
                                  onClick={() => handleRejectTask(task.id)}
                                  className="px-2.5 py-1 text-xs font-semibold text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 rounded-lg transition-all"
                                >
                                  Reject
                                </button>
                              )}
                              {status !== 'proposed' && (
                                <button
                                  onClick={() => handleRestoreTask(task.id)}
                                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                                  title="Restore"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Section 5, 6, 7: Missing Info, Questions, Conflicts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <section className="p-5 rounded-2xl bg-[#0E1524] border border-slate-800/80 space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs tracking-wider uppercase">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Missing Info ({analysis.missing_information.length})</span>
              </div>
              {analysis.missing_information.length === 0 ? (
                <p className="text-xs text-slate-500 py-3">No critical omissions flagged.</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {analysis.missing_information.map((item, idx) => (
                    <li key={idx} className="p-2.5 rounded-xl bg-[#090D16] border border-slate-800/60">
                      <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider block mb-0.5">
                        {item.type.replace('_', ' ')}
                      </span>
                      <p className="text-slate-200 leading-relaxed">{item.detail}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="p-5 rounded-2xl bg-[#0E1524] border border-slate-800/80 space-y-3">
              <div className="flex items-center gap-2 text-sky-400 font-semibold text-xs tracking-wider uppercase">
                <HelpCircle className="w-4 h-4 shrink-0" />
                <span>Unresolved Questions ({analysis.unresolved_questions.length})</span>
              </div>
              {analysis.unresolved_questions.length === 0 ? (
                <p className="text-xs text-slate-500 py-3">No unanswered questions.</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {analysis.unresolved_questions.map((uq, idx) => (
                    <li key={idx} className="p-2.5 rounded-xl bg-[#090D16] border border-slate-800/60 space-y-1">
                      <span className="font-semibold text-slate-100 block">{uq.question}</span>
                      {uq.context && <p className="text-[11px] text-slate-400">{uq.context}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="p-5 rounded-2xl bg-[#0E1524] border border-slate-800/80 space-y-3">
              <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs tracking-wider uppercase">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Conflicting Info ({analysis.conflicts.length})</span>
              </div>
              {analysis.conflicts.length === 0 ? (
                <p className="text-xs text-slate-500 py-3">No contradictory commitments.</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {analysis.conflicts.map((conf, idx) => (
                    <li key={idx} className="p-2.5 rounded-xl bg-[#090D16] border border-slate-800/60 space-y-1.5">
                      <span className="font-semibold text-rose-300 block">{conf.description}</span>
                      {conf.evidence && conf.evidence.length > 0 && (
                        <div className="space-y-1 pl-2 border-l border-rose-500/30">
                          {conf.evidence.map((ev, i) => (
                            <p key={i} className="text-[11px] text-slate-400 italic">"{ev}"</p>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}

      {/* Transcript Collapsible */}
      {meeting.transcript && (
        <section className="rounded-2xl bg-[#0E1524] border border-slate-800/80 overflow-hidden">
          <button
            type="button"
            onClick={() => setIsTranscriptOpen(!isTranscriptOpen)}
            className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <h3 className="text-sm font-bold text-white">Retrieved Transcript / Source Content</h3>
              <span className="text-xs text-slate-400 font-mono">
                ({meeting.transcript.length.toLocaleString()} characters)
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <span className="text-xs">{isTranscriptOpen ? 'Hide' : 'Expand'}</span>
              {isTranscriptOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {isTranscriptOpen && (
            <div className="p-4 sm:p-6 border-t border-slate-800/80 bg-[#090D16]">
              <div className="flex items-center justify-end mb-3">
                <button
                  type="button"
                  onClick={copyTranscript}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  {copiedTranscript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedTranscript ? 'Copied' : 'Copy transcript'}</span>
                </button>
              </div>
              <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto p-4 bg-slate-950/60 rounded-xl border border-slate-800/60">
                {meeting.transcript}
              </pre>
            </div>
          )}
        </section>
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-[#0E1524] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Edit &amp; Verify Task</h3>
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full p-2.5 bg-[#090D16] border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Assignee</label>
                <input
                  type="text"
                  value={editAssignee}
                  onChange={(e) => setEditAssignee(e.target.value)}
                  className="w-full p-2.5 bg-[#090D16] border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Deadline Date</label>
                  <input
                    type="date"
                    value={editDeadline}
                    onChange={(e) => setEditDeadline(e.target.value)}
                    className="w-full p-2.5 bg-[#090D16] border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-hidden focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Deadline Hint</label>
                  <input
                    type="text"
                    value={editDeadlineText}
                    onChange={(e) => setEditDeadlineText(e.target.value)}
                    className="w-full p-2.5 bg-[#090D16] border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all shadow-md"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
