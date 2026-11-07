import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { ToastProvider } from './context/ToastContext.js';
import { Sidebar, type NavTab } from './components/Sidebar.js';
import { Header } from './components/Header.js';
import { AuthPage } from './pages/AuthPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { NewMeetingPage } from './pages/NewMeetingPage.js';
import { AnalysisPage } from './pages/AnalysisPage.js';
import { TaskManagerPage } from './pages/TaskManagerPage.js';
import { MeetingHistoryPage } from './pages/MeetingHistoryPage.js';
import { Sparkles } from 'lucide-react';

function AppContent() {
  const { user, isLoading } = useAuth();

  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').trim();
      if (hash.startsWith('meeting/')) {
        const id = hash.replace('meeting/', '');
        setActiveMeetingId(id);
      } else if (hash === 'new-meeting' || hash === 'task-manager' || hash === 'meeting-history') {
        setCurrentTab(hash as NavTab);
        setActiveMeetingId(null);
      } else {
        setCurrentTab('dashboard');
        setActiveMeetingId(null);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateToTab = (tab: NavTab) => {
    setCurrentTab(tab);
    setActiveMeetingId(null);
    window.location.hash = `#${tab}`;
  };

  const openMeeting = (meetingId: string) => {
    setActiveMeetingId(meetingId);
    window.location.hash = `#meeting/${meetingId}`;
  };

  const backFromMeeting = () => {
    setActiveMeetingId(null);
    window.location.hash = `#${currentTab}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#080C14] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center animate-pulse">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <p className="text-xs text-slate-400 font-medium">Initializing Meeting-to-Action AI...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen flex bg-[#080C14] text-slate-100">
      <Sidebar
        currentTab={currentTab}
        onSelectTab={navigateToTab}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          currentTab={currentTab}
          activeMeetingTitle={activeMeetingId ? 'AI Analysis & Intelligence' : null}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onNewMeetingClick={() => navigateToTab('new-meeting')}
        />

        <main className="flex-1 pb-16">
          {activeMeetingId ? (
            <AnalysisPage
              meetingId={activeMeetingId}
              onBack={backFromMeeting}
              onNavigateToTasks={() => navigateToTab('task-manager')}
            />
          ) : currentTab === 'dashboard' ? (
            <DashboardPage
              onNavigate={navigateToTab}
              onOpenMeeting={openMeeting}
            />
          ) : currentTab === 'new-meeting' ? (
            <NewMeetingPage onMeetingCreated={openMeeting} />
          ) : currentTab === 'task-manager' ? (
            <TaskManagerPage onOpenMeeting={openMeeting} />
          ) : (
            <MeetingHistoryPage
              onOpenMeeting={openMeeting}
              onNewMeeting={() => navigateToTab('new-meeting')}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}
