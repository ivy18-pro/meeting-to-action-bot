import React from 'react';
import { Menu, Plus } from 'lucide-react';
import type { NavTab } from './Sidebar.js';

interface HeaderProps {
  currentTab: NavTab;
  activeMeetingTitle?: string | null;
  onOpenMobileMenu: () => void;
  onNewMeetingClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  activeMeetingTitle,
  onOpenMobileMenu,
  onNewMeetingClick,
}) => {
  const getBreadcrumb = () => {
    if (activeMeetingTitle) {
      return (
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
          <span>Meetings</span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-200 font-semibold truncate max-w-[200px] sm:max-w-xs md:max-w-md">
            {activeMeetingTitle}
          </span>
        </div>
      );
    }

    switch (currentTab) {
      case 'dashboard':
        return <span className="text-sm font-semibold text-white">Dashboard Overview</span>;
      case 'new-meeting':
        return <span className="text-sm font-semibold text-white">New Meeting Transcript</span>;
      case 'task-manager':
        return <span className="text-sm font-semibold text-white">Task Manager</span>;
      case 'meeting-history':
        return <span className="text-sm font-semibold text-white">Meeting Archive</span>;
      default:
        return <span className="text-sm font-semibold text-white">Meeting-to-Action AI</span>;
    }
  };

  return (
    <header className="sticky top-0 z-20 w-full h-16 bg-[#090D16]/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60"
        >
          <Menu className="w-5 h-5" />
        </button>
        {getBreadcrumb()}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onNewMeetingClick}
          className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:scale-95 rounded-xl shadow-md shadow-blue-900/40 transition-all whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Meeting</span>
          <span className="sm:hidden">New</span>
        </button>
      </div>
    </header>
  );
};
