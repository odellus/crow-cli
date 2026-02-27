/* Crow IDE ACP Session History - Browse past sessions */
import { memo, useCallback, useEffect, useState } from "react";
import { ClockIcon, Trash2Icon, MessageSquareIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "./adapters";

interface StoredSession {
  id: string;
  agent_type: string;
  agent_session_id: string | null;
  created_at: string;
  updated_at: string;
  title: string | null;
  metadata: string | null;
}

interface StoredMessage {
  id: string;
  session_id: string;
  direction: string;
  message_type: string | null;
  content: string;
  timestamp: string;
  sequence_number: number;
}

interface SessionHistoryProps {
  onClose: () => void;
  onResumeSession?: (agentSessionId: string) => void;
  className?: string;
}

async function fetchSessions(): Promise<StoredSession[]> {
  const response = await fetch("/api/sessions/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ limit: 50 }),
  });
  if (!response.ok) throw new Error("Failed to fetch sessions");
  const data = await response.json();
  return data.sessions;
}

async function fetchSessionDetails(sessionId: string): Promise<{
  session: StoredSession;
  messages: StoredMessage[];
}> {
  const response = await fetch("/api/sessions/get", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (!response.ok) throw new Error("Failed to fetch session");
  return response.json();
}

async function deleteSession(sessionId: string): Promise<void> {
  const response = await fetch("/api/sessions/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (!response.ok) throw new Error("Failed to delete session");
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function extractUserMessages(messages: StoredMessage[]): string[] {
  const userMessages: string[] = [];
  for (const msg of messages) {
    if (msg.direction === "outbound" && msg.message_type === "session/prompt") {
      try {
        const data = JSON.parse(msg.content);
        if (data.params?.prompt) {
          for (const block of data.params.prompt) {
            if (block.type === "text") {
              userMessages.push(block.text);
            }
          }
        }
      } catch {
        // ignore parse errors
      }
    }
  }
  return userMessages;
}

const SessionListItem = memo<{
  session: StoredSession;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}>(({ session, isSelected, onSelect, onDelete }) => (
  <div
    className={cn(
      "p-2 rounded cursor-pointer border transition-colors",
      isSelected
        ? "bg-blue-900/30 border-blue-700"
        : "bg-gray-800 border-gray-700 hover:bg-gray-700"
    )}
    onClick={onSelect}
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <MessageSquareIcon className="h-3 w-3 text-gray-400 flex-shrink-0" />
        <span className="text-sm font-medium truncate">
          {session.title || `Session with ${session.agent_type}`}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 capitalize">{session.agent_type}</span>
        <Button
          variant="ghost"
          size="xs"
          className="h-5 w-5 p-0 text-gray-500 hover:text-red-400"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2Icon className="h-3 w-3" />
        </Button>
      </div>
    </div>
    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
      <ClockIcon className="h-3 w-3" />
      <span>{formatDate(session.updated_at)}</span>
    </div>
  </div>
));
SessionListItem.displayName = "SessionListItem";

const SessionDetailView = memo<{
  session: StoredSession;
  messages: StoredMessage[];
  onResume?: (agentSessionId: string) => void;
}>(({ session, messages, onResume }) => {
  const userMessages = extractUserMessages(messages);
  const messageCount = messages.length;
  const toolCalls = messages.filter(m => m.message_type === "session/update").length;
  const canResume = session.agent_session_id != null;

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">{session.title || "Untitled Session"}</h3>
          {canResume && onResume && (
            <Button
              variant="default"
              size="xs"
              onClick={() => onResume(session.agent_session_id!)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Resume Session
            </Button>
          )}
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {session.agent_type} • {messageCount} messages • {toolCalls} updates
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Created: {new Date(session.created_at).toLocaleString()}
        </div>
        {session.agent_session_id && (
          <div className="text-xs text-gray-500 mt-1 font-mono">
            ID: {session.agent_session_id.slice(0, 16)}...
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <div className="text-xs text-gray-400 mb-2">User prompts:</div>
        {userMessages.length === 0 ? (
          <div className="text-xs text-gray-500 italic">No user messages found</div>
        ) : (
          userMessages.map((msg, idx) => (
            <div
              key={idx}
              className="p-2 bg-gray-800 rounded border border-gray-700 text-sm"
            >
              {msg.length > 200 ? `${msg.slice(0, 200)}...` : msg}
            </div>
          ))
        )}

        <div className="text-xs text-gray-400 mt-4 mb-2">Raw messages ({messageCount}):</div>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {messages.slice(0, 50).map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "text-xs p-1 rounded font-mono",
                msg.direction === "outbound" ? "bg-blue-900/20" : "bg-gray-800"
              )}
            >
              <span className={msg.direction === "outbound" ? "text-blue-400" : "text-green-400"}>
                {msg.direction === "outbound" ? "→" : "←"}
              </span>{" "}
              <span className="text-gray-400">{msg.message_type || "unknown"}</span>
            </div>
          ))}
          {messages.length > 50 && (
            <div className="text-xs text-gray-500 italic">
              ... and {messages.length - 50} more messages
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
SessionDetailView.displayName = "SessionDetailView";

export const SessionHistory = memo<SessionHistoryProps>(({ onClose, onResumeSession, className }) => {
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<{
    session: StoredSession;
    messages: StoredMessage[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchSessions();
      setSessions(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSessionDetails = useCallback(async (sessionId: string) => {
    try {
      const details = await fetchSessionDetails(sessionId);
      setSelectedDetails(details);
    } catch (e) {
      console.error("Failed to load session details", e);
    }
  }, []);

  const handleDelete = useCallback(async (sessionId: string) => {
    if (!confirm("Delete this session?")) return;
    try {
      await deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(null);
        setSelectedDetails(null);
      }
    } catch (e) {
      console.error("Failed to delete session", e);
    }
  }, [selectedSessionId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (selectedSessionId) {
      loadSessionDetails(selectedSessionId);
    } else {
      setSelectedDetails(null);
    }
  }, [selectedSessionId, loadSessionDetails]);

  return (
    <div className={cn("flex flex-col h-full bg-gray-900", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <ClockIcon className="h-4 w-4 text-gray-400" />
          <h2 className="font-medium text-sm">Session History</h2>
          <span className="text-xs text-gray-500">({sessions.length})</span>
        </div>
        <Button variant="ghost" size="xs" onClick={onClose}>
          ✕
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Session list */}
        <div className="w-1/2 border-r border-gray-700 overflow-y-auto p-2 space-y-1">
          {loading && (
            <div className="text-center text-gray-500 text-sm py-4">Loading...</div>
          )}
          {error && (
            <div className="text-center text-red-400 text-sm py-4">{error}</div>
          )}
          {!loading && !error && sessions.length === 0 && (
            <div className="text-center text-gray-500 text-sm py-4">
              No sessions yet
            </div>
          )}
          {sessions.map((session) => (
            <SessionListItem
              key={session.id}
              session={session}
              isSelected={selectedSessionId === session.id}
              onSelect={() => setSelectedSessionId(session.id)}
              onDelete={() => handleDelete(session.id)}
            />
          ))}
        </div>

        {/* Session detail */}
        <div className="w-1/2 overflow-hidden">
          {selectedDetails ? (
            <SessionDetailView
              session={selectedDetails.session}
              messages={selectedDetails.messages}
              onResume={onResumeSession ? (sessionId) => {
                onResumeSession(sessionId);
                onClose();
              } : undefined}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              <div className="text-center">
                <ChevronRightIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Select a session to view details
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
SessionHistory.displayName = "SessionHistory";
