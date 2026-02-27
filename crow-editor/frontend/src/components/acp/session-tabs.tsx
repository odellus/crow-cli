/* Crow IDE ACP Session Tabs */
import { useAtom, useSetAtom } from "jotai";
import { XIcon, BotIcon } from "lucide-react";
import React, { memo } from "react";
import { Button } from "../ui/button";
import { cn } from "./adapters";
import { AgentSelector } from "./agent-selector";
import {
  type AgentSession,
  type AgentSessionState,
  agentSessionStateAtom,
  removeSession,
  selectedTabAtom,
  type TabId,
  updateSessionLastUsed,
} from "./state";

interface SessionTabProps {
  session: AgentSession;
  isActive: boolean;
  onSelect: (sessionId: TabId) => void;
  onClose: (sessionId: TabId) => void;
}

const SessionTab: React.FC<SessionTabProps> = memo(
  ({ session, isActive, onSelect, onClose }) => {
    return (
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1 text-xs border-r border-gray-700 bg-gray-800 hover:bg-gray-700 cursor-pointer min-w-0",
          isActive && "bg-gray-900 border-b-0 relative z-10"
        )}
        onClick={() => onSelect(session.tabId)}
      >
        <div className="flex items-center gap-1 min-w-0 flex-1 text-gray-300">
          <span className="text-gray-500 text-[10px] font-medium">
            <BotIcon className="h-3 w-3" />
          </span>
          <span className="truncate" title={session.title}>
            {session.title}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-4 w-4 p-0 hover:bg-red-100 hover:text-red-600 flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onClose(session.tabId);
          }}
        >
          <XIcon className="h-3 w-3" />
        </Button>
      </div>
    );
  }
);
SessionTab.displayName = "SessionTab";

interface SessionTabsProps {
  onAddSession?: () => void;
  className?: string;
}

interface SessionListProps {
  sessions: AgentSession[];
  activeTabId: TabId | null;
  onSelectSession: (sessionId: TabId) => void;
  onCloseSession: (sessionId: TabId) => void;
}

const SessionList = memo<SessionListProps>(
  ({ sessions, activeTabId, onSelectSession, onCloseSession }) => (
    <div className="flex min-w-0 flex-1 overflow-x-auto">
      {sessions.map((session) => (
        <SessionTab
          key={session.tabId}
          session={session}
          isActive={session.tabId === activeTabId}
          onSelect={onSelectSession}
          onClose={onCloseSession}
        />
      ))}
    </div>
  )
);
SessionList.displayName = "SessionList";

interface EmptySessionTabsProps {
  className?: string;
}

const EmptySessionTabs = memo<EmptySessionTabsProps>(({ className }) => (
  <div className={cn("flex items-center border-b border-gray-700 bg-gray-800", className)}>
    <AgentSelector className="h-6" />
  </div>
));
EmptySessionTabs.displayName = "EmptySessionTabs";

export const SessionTabs: React.FC<SessionTabsProps> = memo(({ className }) => {
  const [sessionState, setSessionState] = useAtom(agentSessionStateAtom);
  const setActiveSession = useSetAtom(selectedTabAtom);

  const handleSelectSession = (sessionId: TabId) => {
    setActiveSession(sessionId);
    setSessionState((prev) => updateSessionLastUsed(prev as AgentSessionState, sessionId));
  };

  const handleCloseSession = (sessionId: TabId) => {
    setSessionState((prev) => removeSession(prev as AgentSessionState, sessionId));
  };

  const { sessions, activeTabId } = sessionState;

  if (sessions.length === 0) {
    return <EmptySessionTabs className={className} />;
  }

  return (
    <div
      className={cn(
        "flex items-center border-b border-gray-700 bg-gray-800 overflow-hidden",
        className
      )}
    >
      <SessionList
        sessions={sessions}
        activeTabId={activeTabId}
        onSelectSession={handleSelectSession}
        onCloseSession={handleCloseSession}
      />
      <AgentSelector className="h-6 flex-shrink-0" />
    </div>
  );
});
SessionTabs.displayName = "SessionTabs";
