import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../services/api.js';
import type { Meeting } from '../types.js';
import {
  Search,
  FileText,
  Trash2,
  ExternalLink,
  Sparkles,
  X,
} from 'lucide-react';
import { ConfirmationModal } from '../components/ConfirmationModal.js';
import { useToast } from '../context/ToastContext.js';

interface MeetingHistoryPageProps {
  onOpenMeeting: (meetingId: string) => void;
  onNewMeeting: () => void;
}

type EnrichedMeeting = Meeting & {
  tasksCount: number;
  needingReviewCount: number;
  decisionsCount: number;
};

export const MeetingHistoryPage: React.FC<MeetingHistoryPageProps> = ({
  onOpenMeeting,
  onNewMeeting,
}) => {
  const { showToast } = useToast();

  const [meetings, setMeetings] = useState<EnrichedMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [meetingToDelete, setMeetingToDelete] = useState<EnrichedMeeting | null>(null);

  const fetchMeetings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.meetings.list();
      setMeetings(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load meetings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const handleDeleteMeeting = async () => {
    if (!meetingToDelete) return;
    try {
      await api.meetings.delete(meetingToDelete.id);
      setMeetings((prev) => prev.filter((m) => m.id !== meetingToDelete.id));
      showToast('Meeting and associated tasks were deleted.', 'info');
      setMeetingToDelete(null);
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete meeting.', 'error');
    }
  };

  const filteredMeetings = useMemo(() => {
    if (!searchQuery.trim()) return meetings;
    const query = searchQuery.toLowerCase().trim();

    return meetings.filter((m) => {
      const matchTitle = m.title.toLowerCase().includes(query);
      const matchSummary = (m.summary || '').toLowerCase().includes(query);
      const matchParticipants = m.participants.some((p) => p.toLowerCase().includes(query));
      return matchTitle || matchSummary || matchParticipants;
    });
  }, [meetings, searchQuery]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Meeting Archive</h1>
          <p className="text-xs text-slate-400 mt-1">
            Browse past recordings, view extracted intelligence, and manage linked action items.
          </p>
        </div>

        <button
          onClick={onNewMeeting}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:scale-95 rounded-xl shadow-md shadow-blue-900/30 transition-all self-start sm:self-auto shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          <span>New Meeting</span>
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by title, participant, or summary..."
          className="w-full pl-10 pr-4 py-2 bg-[#0E1524] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="p-8 bg-[#0E1524] border border-slate-800 rounded-2xl space-y-4 animate-pulse">
          <div className="h-10 bg-slate-800/40 rounded-xl" />
          <div className="h-10 bg-slate-800/30 rounded-xl" />
        </div>
      ) : filteredMeetings.length === 0 ? (
        <div className="p-12 bg-[#0E1524] border border-slate-800 rounded-2xl text-center space-y-3">
          <FileText className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-white">No meetings found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery ? `No meetings matched "${searchQuery}".` : 'You have not recorded or logged any meetings yet.'}
          </p>
        </div>
      ) : (
        <div className="bg-[#0E1524] border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-medium bg-slate-900/40">
                  <th className="py-3 px-4">Meeting Title</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Participants</th>
                  <th className="py-3 px-3">Extracted Tasks</th>
                  <th className="py-3 px-3">Decisions</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredMeetings.map((m) => {
                  return (
                    <tr
                      key={m.id}
                      className="group hover:bg-slate-900/50 transition-colors cursor-pointer"
                      onClick={() => onOpenMeeting(m.id)}
                    >
                      <td className="py-3.5 px-4 align-top max-w-xs">
                        <span className="font-semibold text-white group-hover:text-blue-400 transition-colors block">
                          {m.title}
                        </span>
                        {m.summary && (
                          <span className="text-[11px] text-slate-400 line-clamp-1 mt-0.5 font-normal">
                            {m.summary}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 align-top whitespace-nowrap font-mono text-slate-300">
                        {m.date}
                      </td>

                      <td className="py-3.5 px-3 align-top max-w-[180px]">
                        {m.participants.length > 0 ? (
                          <span className="text-slate-300 line-clamp-1">{m.participants.join(', ')}</span>
                        ) : (
                          <span className="text-slate-500">None specified</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 align-top whitespace-nowrap">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-slate-200 block">
                            {m.tasksCount} {m.tasksCount === 1 ? 'task' : 'tasks'}
                          </span>
                          {m.needingReviewCount > 0 && (
                            <span className="text-[10px] text-amber-400 font-medium block">
                              {m.needingReviewCount} needs review
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 align-top whitespace-nowrap font-semibold text-emerald-400">
                        {m.decisionsCount}
                      </td>

                      <td className="py-3.5 px-3 align-top whitespace-nowrap">
                        <span
                          className={`text-xs font-semibold capitalize ${
                            m.analysisStatus === 'completed'
                              ? 'text-emerald-400'
                              : m.analysisStatus === 'failed'
                              ? 'text-rose-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {m.analysisStatus === 'completed'
                            ? 'Analyzed'
                            : m.analysisStatus === 'processing'
                            ? 'Analyzing'
                            : m.analysisStatus === 'failed'
                            ? 'Failed'
                            : 'Pending'}
                        </span>
                      </td>

                      <td
                        className="py-3.5 px-4 align-top text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onOpenMeeting(m.id)}
                            className="p-1.5 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-slate-800 transition-colors"
                            title="Open meeting analysis"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setMeetingToDelete(m)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                            title="Delete meeting and associated tasks"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={Boolean(meetingToDelete)}
        title="Delete Meeting &amp; Associated Tasks"
        message={`Are you sure you want to delete "${meetingToDelete?.title}"? All extracted tasks, intelligence summaries, and decisions tied to this meeting will be permanently deleted from your account.`}
        confirmLabel="Delete Meeting"
        isDestructive={true}
        onConfirm={handleDeleteMeeting}
        onCancel={() => setMeetingToDelete(null)}
      />
    </div>
  );
};
