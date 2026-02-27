/* Crow IDE ACP Agent Selector */
import { useAtom, useSetAtom } from "jotai";
import { ChevronDownIcon, BotIcon } from "lucide-react";
import React, { memo, useState } from "react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { cn } from "./adapters";
import {
  type AgentSession,
  addSession,
  agentSessionStateAtom,
  type ExternalAgentId,
  getAgentSessionSupport,
  selectedTabAtom,
} from "./state";

interface AgentSelectorProps {
  onSessionCreated?: (agentId: ExternalAgentId) => void;
  className?: string;
}

const AVAILABLE_AGENTS = [
  {
    id: "karla" as ExternalAgentId,
    displayName: "Karla",
    iconId: "karla",
  },
  {
    id: "claude" as ExternalAgentId,
    displayName: "Claude",
    iconId: "anthropic",
  },
  {
    id: "gemini" as ExternalAgentId,
    displayName: "Gemini",
    iconId: "google",
  },
  {
    id: "codex" as ExternalAgentId,
    displayName: "Codex",
    iconId: "openai",
  },
  {
    id: "opencode" as ExternalAgentId,
    displayName: "OpenCode",
    iconId: "opencode",
  },
  {
    id: "openhands" as ExternalAgentId,
    displayName: "OpenHands",
    iconId: "openhands",
  },
  {
    id: "crow" as ExternalAgentId,
    displayName: "Crow",
    iconId: "crow",
  },
  {
    id: "crow-agent" as ExternalAgentId,
    displayName: "Crow Agent",
    iconId: "crow-agent",
  },
] as const;

interface AgentMenuItemProps {
  agent: (typeof AVAILABLE_AGENTS)[number];
  onSelect: (agentId: ExternalAgentId) => void;
  existingSessions: AgentSession[];
}

const AgentMenuItem = memo<AgentMenuItemProps>(
  ({ agent, onSelect, existingSessions }) => {
    const sessionSupport = getAgentSessionSupport(agent.id);
    const hasExistingSession = existingSessions.some(
      (s) => s.agentId === agent.id
    );

    const resetSession = sessionSupport === "single" && hasExistingSession;
    const text = resetSession
      ? `Reset ${agent.displayName} session`
      : `New ${agent.displayName} session`;

    return (
      <DropdownMenuItem
        onClick={() => onSelect(agent.id)}
        className="cursor-pointer"
      >
        <div className="flex items-center w-full">
          <BotIcon className="h-3 w-3 mr-2" />
          <span>{text}</span>
        </div>
      </DropdownMenuItem>
    );
  }
);
AgentMenuItem.displayName = "AgentMenuItem";

export const AgentSelector: React.FC<AgentSelectorProps> = memo(
  ({ onSessionCreated, className }) => {
    const [sessionState, setSessionState] = useAtom(agentSessionStateAtom);
    const setActiveTab = useSetAtom(selectedTabAtom);
    const [isOpen, setIsOpen] = useState(false);

    const handleCreateSession = (agentId: ExternalAgentId) => {
      const newState = addSession(sessionState, {
        agentId,
      });

      setSessionState(newState);
      setActiveTab(newState.activeTabId);
      setIsOpen(false);

      onSessionCreated?.(agentId);
    };

    return (
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild={true}>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-6 gap-1 px-2 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded focus-visible:ring-0 text-gray-200",
              className
            )}
          >
            <span>New session</span>
            <ChevronDownIcon className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-fit">
          {AVAILABLE_AGENTS.map((agent) => (
            <AgentMenuItem
              key={agent.id}
              agent={agent}
              onSelect={handleCreateSession}
              existingSessions={sessionState.sessions}
            />
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
);
AgentSelector.displayName = "AgentSelector";
