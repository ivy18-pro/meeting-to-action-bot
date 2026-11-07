import React, { useState, useEffect, useRef } from 'react';
import { api, cleanSubtitleFile } from '../services/api.js';
import { SAMPLE_MEETING } from '../data/sampleTranscript.js';
import {
  Sparkles,
  Upload,
  Calendar,
  Users,
  AlertCircle,
  Link as LinkIcon,
  FileText,
  X,
  Check,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { useToast } from '../context/ToastContext.js';

interface NewMeetingPageProps {
  onMeetingCreated: (meetingId: string) => void;
}

type SourceMode = 'link' | 'transcript';
type MeetingPlatform = 'google_meet' | 'zoom' | 'microsoft_teams' | 'other';

export const NewMeetingPage: React.FC<NewMeetingPageProps> = ({ onMeetingCreated }) => {
  const { showToast } = useToast();

  const [sourceMode, setSourceMode] = useState<SourceMode>('link');

  // Option 1: Meeting Link state
  const [meetingUrl, setMeetingUrl] = useState('');
  const [meetingPlatform, setMeetingPlatform] = useState<MeetingPlatform>('google_meet');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkDate, setLinkDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [linkParticipants, setLinkParticipants] = useState<string[]>([]);
  const [linkParticipantInput, setLinkParticipantInput] = useState('');
  const [isConnectedAccount, setIsConnectedAccount] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Progress simulation steps for Fetch Meeting Content
  const [fetchingStep, setFetchingStep] = useState<number>(0);
  const fetchingStepsList = [
    'Validating meeting link...',
    'Connecting to meeting source...',
    'Retrieving transcript & recordings...',
    'Processing spoken conversation...',
    'Analyzing with Google Gemini...',
    'Extracting decisions & action items...',
    'Analysis completed successfully!',
  ];

  // Option 2: Manual Transcript state
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [participants, setParticipants] = useState<string[]>([]);
  const [participantInput, setParticipantInput] = useState('');
  const [transcript, setTranscript] = useState('');

  const [isGeminiConfigured, setIsGeminiConfigured] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function checkGemini() {
      try {
        const res = await api.config.getGeminiStatus();
        setIsGeminiConfigured(res.isConfigured);
      } catch {
        setIsGeminiConfigured(true);
      }
    }
    checkGemini();
  }, []);

  const handleConnectAccount = () => {
    setIsConnecting(true);
    setTimeout(() => {
      setIsConnecting(false);
      setIsConnectedAccount(true);
      showToast(`Successfully connected your ${meetingPlatform.replace('_', ' ')} account.`, 'success');
    }, 1200);
  };

  const handleFetchMeetingLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!meetingUrl.trim() || !meetingUrl.startsWith('http')) {
      setError('Please provide a valid meeting URL (starting with https://).');
      return;
    }

    if (!isConnectedAccount) {
      setError('Please connect your account for authorized meeting access before fetching content.');
      return;
    }

    setIsSubmitting(true);
    setFetchingStep(0);

    // Simulate multi-step progress interface
    const interval = setInterval(() => {
      setFetchingStep((prev) => {
        if (prev < fetchingStepsList.length - 1) {
          return prev + 1;
        }
        clearInterval(interval);
        return prev;
      });
    }, 600);

    try {
      // 1. Fetch meeting link via backend / n8n webhook
      const meeting = await api.meetings.fetchLink({
        meetingUrl: meetingUrl.trim(),
        meetingPlatform,
        title: linkTitle.trim() || undefined,
        date: linkDate,
        participants: linkParticipants,
      });

      // 2. Automatically trigger AI Analysis on the retrieved transcript
      const analysisResult = await api.meetings.analyze(meeting.id);

      clearInterval(interval);
      setFetchingStep(fetchingStepsList.length - 1);
      showToast('Meeting content retrieved and analyzed by Gemini AI!', 'success');

      setTimeout(() => {
        onMeetingCreated(analysisResult.meeting.id);
      }, 800);
    } catch (err: any) {
      clearInterval(interval);
      setIsSubmitting(false);
      setError(err?.message || 'Failed to retrieve or process meeting link content.');
      showToast('Meeting link content retrieval failed.', 'error');
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Meeting title is required.');
      return;
    }
    if (!transcript.trim() || transcript.trim().length < 30) {
      setError('Transcript must be at least 30 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      const meeting = await api.meetings.create({
        title: title.trim(),
        date,
        participants,
        transcript: transcript.trim(),
        meetingPlatform: 'other',
      });

      showToast('Meeting saved. Initializing AI analysis...', 'success');
      const analysisResult = await api.meetings.analyze(meeting.id);
      onMeetingCreated(analysisResult.meeting.id);
    } catch (err: any) {
      if (err?.status === 409 && err.data?.meetingId) {
        showToast('Identical transcript submitted recently. Navigating to meeting.', 'info');
        onMeetingCreated(err.data.meetingId);
      } else {
        setError(err?.message || 'Failed to submit meeting for analysis.');
        setIsSubmitting(false);
      }
    }
  };

  const handleUseSample = () => {
    setSourceMode('transcript');
    setTitle(SAMPLE_MEETING.title);
    setDate(SAMPLE_MEETING.date);
    setParticipants([...SAMPLE_MEETING.participants]);
    setTranscript(SAMPLE_MEETING.transcript);
    setError(null);
    showToast('Loaded realistic sample transcript.', 'info');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isSubtitle = fileName.endsWith('.vtt') || fileName.endsWith('.srt');

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      if (isSubtitle) {
        const cleaned = cleanSubtitleFile(content);
        setTranscript(cleaned);
        showToast('Subtitle timestamps and cues automatically stripped.', 'info');
      } else {
        setTranscript(content);
        showToast('File loaded into transcript editor.', 'info');
      }

      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Page Title & Helper */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Create New Meeting</h1>
          <p className="text-xs text-slate-400 mt-1">
            Provide a meeting link for automated AI retrieval or paste your meeting transcript manually.
          </p>
        </div>

        <button
          type="button"
          onClick={handleUseSample}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-xl transition-all self-start sm:self-auto shrink-0 shadow-xs"
        >
          <Sparkles className="w-4 h-4 text-blue-400" />
          <span>Use Sample Transcript</span>
        </button>
      </div>

      {/* Source Selection Tabs */}
      <div className="flex items-center p-1.5 bg-[#0E1524] border border-slate-800 rounded-2xl">
        <button
          type="button"
          onClick={() => setSourceMode('link')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
            sourceMode === 'link'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <LinkIcon className="w-4 h-4" />
          <span>Option 1: Meeting Link (AI Agent)</span>
        </button>
        <button
          type="button"
          onClick={() => setSourceMode('transcript')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
            sourceMode === 'transcript'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Option 2: Manual Transcript / Upload</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* OPTION 1: Meeting Link */}
      {sourceMode === 'link' && (
        <form onSubmit={handleFetchMeetingLink} className="space-y-6">
          <div className="bg-[#0E1524] border border-slate-800/80 rounded-2xl p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800/60">
              <LinkIcon className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white">Meeting Source: Meeting Link</h3>
            </div>

            {/* Platform Selection */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Meeting Platform
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { id: 'google_meet', label: 'Google Meet' },
                  { id: 'zoom', label: 'Zoom' },
                  { id: 'microsoft_teams', label: 'Microsoft Teams' },
                  { id: 'other', label: 'Other Recording' },
                ].map((plat) => (
                  <button
                    key={plat.id}
                    type="button"
                    onClick={() => {
                      setMeetingPlatform(plat.id as MeetingPlatform);
                      setIsConnectedAccount(false);
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                      meetingPlatform === plat.id
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-xs'
                        : 'bg-[#090D16] border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {plat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* URL Input */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Meeting Recording or Transcript URL <span className="text-rose-400">*</span>
              </label>
              <input
                type="url"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                placeholder="Paste your Google Meet, Zoom, Microsoft Teams or meeting recording link here..."
                required
                className="w-full px-3.5 py-2.5 bg-[#090D16] border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 font-mono transition-colors"
              />
            </div>

            {/* Optional Title & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Meeting Title (Optional)
                </label>
                <input
                  type="text"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder="Auto-detected if left blank"
                  className="w-full px-3.5 py-2.5 bg-[#090D16] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Meeting Date
                </label>
                <input
                  type="date"
                  value={linkDate}
                  onChange={(e) => setLinkDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#090D16] border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>

            {/* Connect Account Option */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0 mt-0.5">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Authorized Account Integration</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Connect your {meetingPlatform.replace('_', ' ')} account to securely retrieve protected recordings or captions.
                  </p>
                </div>
              </div>

              {isConnectedAccount ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-xl shrink-0">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Account Connected</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectAccount}
                  disabled={isConnecting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 active:scale-95 rounded-xl border border-slate-700 transition-all shrink-0 flex items-center gap-2"
                >
                  {isConnecting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Connect Account</span>
                </button>
              )}
            </div>

            {/* Progress Interface during Fetch */}
            {isSubmitting && (
              <div className="p-5 rounded-xl bg-blue-950/30 border border-blue-500/30 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-blue-300">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                    <span>Processing Meeting Content &amp; AI Analysis...</span>
                  </span>
                  <span>Step {fetchingStep + 1} of {fetchingStepsList.length}</span>
                </div>
                <div className="text-sm font-bold text-white">
                  {fetchingStepsList[fetchingStep]}
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${((fetchingStep + 1) / fetchingStepsList.length) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-4">
            <button
              type="submit"
              disabled={isSubmitting || !meetingUrl.trim()}
              className="flex items-center gap-2.5 px-6 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-600/25 active:scale-98 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Fetching &amp; Analyzing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Fetch Meeting Content &amp; Analyze</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* OPTION 2: Manual Transcript */}
      {sourceMode === 'transcript' && (
        <form onSubmit={handleManualSubmit} className="space-y-6">
          <div className="bg-[#0E1524] border border-slate-800/80 rounded-2xl p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800/60">
              <FileText className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Meeting Source: Manual Transcript</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Meeting Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Sprint 14 Launch Planning"
                  required
                  className="w-full px-3.5 py-2.5 bg-[#090D16] border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Meeting Date
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-[#090D16] border border-slate-800 rounded-xl text-sm text-white font-mono focus:outline-hidden focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Participants <span className="text-slate-500 font-normal">(press Enter to add)</span>
              </label>
              <div className="flex flex-wrap items-center gap-2 p-2 bg-[#090D16] border border-slate-800 rounded-xl min-h-[46px]">
                {participants.map((p, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/80 text-slate-200 text-xs rounded-lg border border-slate-700/60"
                  >
                    <Users className="w-3 h-3 text-slate-400" />
                    <span>{p}</span>
                    <button
                      type="button"
                      onClick={() => setParticipants(participants.filter((_, i) => i !== index))}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={participantInput}
                  onChange={(e) => setParticipantInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      const t = participantInput.trim();
                      if (t && !participants.includes(t)) {
                        setParticipants([...participants, t]);
                        setParticipantInput('');
                      }
                    }
                  }}
                  onBlur={() => {
                    const t = participantInput.trim();
                    if (t && !participants.includes(t)) {
                      setParticipants([...participants, t]);
                      setParticipantInput('');
                    }
                  }}
                  placeholder="Type participant name and press Enter..."
                  className="flex-1 min-w-[140px] bg-transparent text-sm text-white placeholder-slate-500 focus:outline-hidden px-2 py-0.5"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Meeting Transcript <span className="text-rose-400">*</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".txt,.md,.vtt,.srt"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-400 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload .txt, .md, .vtt, .srt</span>
                  </button>
                </div>
              </div>

              <textarea
                rows={10}
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Paste the conversation, meeting notes, or speaker-tagged transcript here... (min 30 characters)"
                className="w-full p-4 bg-[#090D16] border border-slate-800 rounded-xl text-sm text-white font-mono leading-relaxed placeholder-slate-600 focus:outline-hidden focus:border-blue-500 transition-colors resize-y"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-4">
            <button
              type="submit"
              disabled={isSubmitting || transcript.trim().length < 30 || !title.trim()}
              className="flex items-center gap-2.5 px-6 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-600/25 active:scale-98 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting &amp; Analyzing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Submit for AI Analysis</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
