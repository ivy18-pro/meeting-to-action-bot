import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../services/api.js';
import type { Task, TaskStatus, Meeting } from '../types.js';
import {
  Search,
  Plus,
  CheckCircle2,
  Circle,
  User as UserIcon,
  FileText,
  Trash2,
  Edit3,
  Clock,
  X,
} from 'lucide-react';
import { ConfirmationModal } from '../components/ConfirmationModal.js';
import { useToast } from '../context/ToastContext.js';

interface TaskManagerPageProps {
  onOpenMeeting: (meetingId: string) => void;
}

type FilterTab = 'all' | 'pending' | 'in_progress' | 'completed' | 'overdue';

export const TaskManagerPage: React.FC<TaskManagerPageProps> = ({ onOpenMeeting }) => {
  const { showToast } = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [currentFilter, setCurrentFilter] = useState<FilterTab>('all');

  // Manual Task Creation Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newDescription, setNewDescription] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [newDeadlineText, setNewDeadlineText] = useState('');
  const [newStatus, setNewStatus] = useState<TaskStatus>('pending');
  const [newMeetingId, setNewMeetingId] = useState<string>('');

  // Edit Task Modal
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editDeadlineText, setEditDeadlineText] = useState('');
  const [editStatus, setEditStatus] = useState<TaskStatus>('pending');
  const [editMeetingId, setEditMeetingId] = useState<string>('');

  // Delete confirmation
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [fetchedTasks, fetchedMeetings] = await Promise.all([
        api.tasks.list(),
        api.meetings.list(),
      ]);
      setTasks(fetchedTasks);
      setMeetings(fetchedMeetings);
    } catch (err: any) {
      setError(err?.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const getDeadlineInfo = (task: Task) => {
    if (!task.deadline) {
      return {
        label: task.deadlineText || 'No deadline',
        isOverdue: false,
        isToday: false,
      };
    }

    if (task.status === 'completed') {
      return {
        label: task.deadline,
        isOverdue: false,
        isToday: false,
      };
    }

    if (task.deadline === todayStr) {
      return {
        label: 'Due today',
        isOverdue: false,
        isToday: true,
      };
    }

    if (task.deadline < todayStr) {
      const diffMs = new Date(todayStr).getTime() - new Date(task.deadline).getTime();
      const diffDays = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      return {
        label: `${diffDays}d overdue`,
        isOverdue: true,
        isToday: false,
      };
    }

    const diffMs = new Date(task.deadline).getTime() - new Date(todayStr).getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return {
      label: diffDays <= 7 ? `In ${diffDays}d` : task.deadline,
      isOverdue: false,
      isToday: false,
    };
  };

  const handleToggleComplete = async (task: Task) => {
    const nextStatus: TaskStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      const updated = await api.tasks.update(task.id, { status: nextStatus });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      showToast(
        nextStatus === 'completed' ? 'Task marked as completed.' : 'Task reopened.',
        'success'
      );
    } catch (err: any) {
      showToast(err?.message || 'Failed to update status.', 'error');
    }
  };

  const handleStatusChange = async (task: Task, newStatusVal: TaskStatus) => {
    try {
      const updated = await api.tasks.update(task.id, { status: newStatusVal });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      showToast(`Status updated to ${newStatusVal.replace('_', ' ')}.`, 'info');
    } catch (err: any) {
      showToast(err?.message || 'Failed to update status.', 'error');
    }
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;
    try {
      await api.tasks.delete(taskToDelete.id);
      setTasks((prev) => prev.filter((t) => t.id !== taskToDelete.id));
      showToast('Task deleted.', 'info');
      setTaskToDelete(null);
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete task.', 'error');
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDescription.trim()) {
      showToast('Task description is required.', 'error');
      return;
    }

    try {
      const created = await api.tasks.create({
        description: newDescription.trim(),
        assignee: newAssignee.trim() || null,
        deadline: newDeadline || null,
        deadlineText: newDeadlineText.trim() || null,
        status: newStatus,
        meetingId: newMeetingId || null,
      });
      setTasks((prev) => [created, ...prev]);
      showToast('Task created successfully.', 'success');
      setIsCreateModalOpen(false);
      setNewDescription('');
      setNewAssignee('');
      setNewDeadline('');
      setNewDeadlineText('');
      setNewStatus('pending');
      setNewMeetingId('');
    } catch (err: any) {
      showToast(err?.message || 'Failed to create task.', 'error');
    }
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setEditDescription(task.description);
    setEditAssignee(task.assignee || '');
    setEditDeadline(task.deadline || '');
    setEditDeadlineText(task.deadlineText || '');
    setEditStatus(task.status);
    setEditMeetingId(task.meetingId || '');
  };

  const handleSaveEdit = async () => {
    if (!editingTask) return;
    if (!editDescription.trim()) {
      showToast('Description cannot be empty.', 'error');
      return;
    }

    try {
      const updated = await api.tasks.update(editingTask.id, {
        description: editDescription.trim(),
        assignee: editAssignee.trim() || null,
        deadline: editDeadline || null,
        deadlineText: editDeadlineText.trim() || null,
        status: editStatus,
        meetingId: editMeetingId || null,
      });
      setTasks((prev) => prev.map((t) => (t.id === editingTask.id ? updated : t)));
      showToast('Task saved successfully.', 'success');
      setEditingTask(null);
    } catch (err: any) {
      showToast(err?.message || 'Failed to update task.', 'error');
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (currentFilter === 'pending' && task.status !== 'pending') return false;
      if (currentFilter === 'in_progress' && task.status !== 'in_progress') return false;
      if (currentFilter === 'completed' && task.status !== 'completed') return false;
      if (currentFilter === 'overdue') {
        if (task.status === 'completed') return false;
        if (!task.deadline || task.deadline >= todayStr) return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesDesc = task.description.toLowerCase().includes(query);
        const matchesAssignee = (task.assignee || '').toLowerCase().includes(query);
        const matchesMeeting = (task.meetingTitle || '').toLowerCase().includes(query);
        return matchesDesc || matchesAssignee || matchesMeeting;
      }

      return true;
    });
  }, [tasks, currentFilter, searchQuery, todayStr]);

  const tabCounts = useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    let overdue = 0;

    for (const t of tasks) {
      if (t.status === 'completed') {
        completed++;
      } else {
        if (t.status === 'pending') pending++;
        if (t.status === 'in_progress') inProgress++;
        if (t.deadline && t.deadline < todayStr) overdue++;
      }
    }

    return {
      all: tasks.length,
      pending,
      in_progress: inProgress,
      completed,
      overdue,
    };
  }, [tasks, todayStr]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Task Manager</h1>
          <p className="text-xs text-slate-400 mt-1">
            Track and manage all tasks across your meetings and workflows.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:scale-95 rounded-xl shadow-md shadow-blue-900/30 transition-all self-start sm:self-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Task</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-[#0E1524] border border-slate-800 rounded-xl overflow-x-auto">
          {(
            [
              { id: 'all', label: 'All Tasks', count: tabCounts.all },
              { id: 'pending', label: 'Pending', count: tabCounts.pending },
              { id: 'in_progress', label: 'In Progress', count: tabCounts.in_progress },
              { id: 'completed', label: 'Completed', count: tabCounts.completed },
              { id: 'overdue', label: 'Overdue', count: tabCounts.overdue },
            ] as const
          ).map((tab) => {
            const isActive = currentFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                    isActive ? 'bg-blue-700/60 text-white' : 'bg-slate-800/80 text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full md:w-72 shrink-0">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks, assignee, meeting..."
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
      </div>

      {/* Tasks Table */}
      {loading ? (
        <div className="p-8 bg-[#0E1524] border border-slate-800 rounded-2xl space-y-4 animate-pulse">
          <div className="h-10 bg-slate-800/40 rounded-xl" />
          <div className="h-10 bg-slate-800/30 rounded-xl" />
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="p-12 bg-[#0E1524] border border-slate-800 rounded-2xl text-center space-y-3">
          <Clock className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-white">No tasks found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery
              ? `No results for "${searchQuery}".`
              : currentFilter === 'overdue'
              ? 'Great job! You have no overdue tasks.'
              : 'Create tasks manually or from meetings to track your progress.'}
          </p>
        </div>
      ) : (
        <div className="bg-[#0E1524] border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-medium bg-slate-900/40">
                  <th className="py-3 px-4 w-10">Done</th>
                  <th className="py-3 px-3 min-w-[200px]">Task Description</th>
                  <th className="py-3 px-3">Meeting</th>
                  <th className="py-3 px-3">Assignee</th>
                  <th className="py-3 px-3">Deadline</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Created</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredTasks.map((task) => {
                  const deadlineInfo = getDeadlineInfo(task);
                  const isCompleted = task.status === 'completed';

                  return (
                    <tr
                      key={task.id}
                      className={`group hover:bg-slate-900/50 transition-colors ${
                        isCompleted ? 'opacity-60 bg-slate-950/20' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 align-top">
                        <button
                          onClick={() => handleToggleComplete(task)}
                          className="text-slate-400 hover:text-emerald-400 transition-colors"
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <Circle className="w-5 h-5 text-slate-600 hover:text-slate-400" />
                          )}
                        </button>
                      </td>

                      <td className="py-3.5 px-3 align-top font-semibold text-white">
                        <span className={isCompleted ? 'line-through text-slate-400' : ''}>
                          {task.description}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 align-top whitespace-nowrap">
                        {task.meetingId && task.meetingTitle ? (
                          <button
                            onClick={() => onOpenMeeting(task.meetingId!)}
                            className="text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1.5 transition-colors text-left"
                          >
                            <FileText className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate max-w-[140px]">{task.meetingTitle}</span>
                          </button>
                        ) : (
                          <span className="text-slate-500">General Task</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 align-top whitespace-nowrap">
                        {task.assignee ? (
                          <div className="flex items-center gap-1.5 text-slate-200">
                            <UserIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span className="font-medium">{task.assignee}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500">Unassigned</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 align-top whitespace-nowrap font-mono">
                        <span
                          className={`font-semibold block ${
                            deadlineInfo.isOverdue
                              ? 'text-rose-400'
                              : deadlineInfo.isToday
                              ? 'text-amber-400'
                              : 'text-slate-300'
                          }`}
                        >
                          {deadlineInfo.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 align-top whitespace-nowrap">
                        <select
                          value={task.status}
                          onChange={(e) =>
                            handleStatusChange(task, e.target.value as TaskStatus)
                          }
                          className="bg-[#090D16] border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1 focus:outline-hidden focus:border-blue-500 capitalize"
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                      </td>

                      <td className="py-3.5 px-3 align-top whitespace-nowrap font-mono text-[11px] text-slate-400">
                        {task.createdAt.split('T')[0]}
                      </td>

                      <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(task)}
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                            title="Edit task"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setTaskToDelete(task)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                            title="Delete task"
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

      {/* Create Task Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#0E1524] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Create New Task</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Task Description <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="e.g. Update deployment config"
                  required
                  className="w-full p-2.5 bg-[#090D16] border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Link to Meeting</label>
                <select
                  value={newMeetingId}
                  onChange={(e) => setNewMeetingId(e.target.value)}
                  className="w-full p-2.5 bg-[#090D16] border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-blue-500"
                >
                  <option value="">No Meeting (General Task)</option>
                  {meetings.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.date})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Assignee</label>
                <input
                  type="text"
                  value={newAssignee}
                  onChange={(e) => setNewAssignee(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  className="w-full p-2.5 bg-[#090D16] border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Deadline Date</label>
                  <input
                    type="date"
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    className="w-full p-2.5 bg-[#090D16] border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-hidden focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as TaskStatus)}
                    className="w-full p-2.5 bg-[#090D16] border border-slate-800 rounded-xl text-xs text-white capitalize focus:outline-hidden focus:border-blue-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all shadow-md"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#0E1524] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Edit Task</h3>
              <button onClick={() => setEditingTask(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Task Description <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full p-2.5 bg-[#090D16] border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Link to Meeting</label>
                <select
                  value={editMeetingId}
                  onChange={(e) => setEditMeetingId(e.target.value)}
                  className="w-full p-2.5 bg-[#090D16] border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-blue-500"
                >
                  <option value="">No Meeting (General Task)</option>
                  {meetings.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.date})
                    </option>
                  ))}
                </select>
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
                  <label className="block text-xs font-medium text-slate-300 mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as TaskStatus)}
                    className="w-full p-2.5 bg-[#090D16] border border-slate-800 rounded-xl text-xs text-white capitalize focus:outline-hidden focus:border-blue-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
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

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(taskToDelete)}
        title="Delete Task"
        message={`Are you sure you want to delete "${taskToDelete?.description}"?`}
        confirmLabel="Delete Task"
        isDestructive={true}
        onConfirm={confirmDeleteTask}
        onCancel={() => setTaskToDelete(null)}
      />
    </div>
  );
};
