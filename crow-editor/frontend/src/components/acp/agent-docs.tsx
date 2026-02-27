/* Crow IDE ACP Agent Docs */
import { TerminalIcon, CopyIcon, BotIcon } from "lucide-react";
import { memo, useState } from "react";
import { Button } from "../ui/button";
import { cn } from "./adapters";
import {
  type ExternalAgentId,
  getAgentConnectionCommand,
  getAgentDisplayName,
  getAllAgentIds,
} from "./state";

// Opencode currently edits files without requesting for permission
const BETA_AGENTS = new Set<ExternalAgentId>(["opencode"]);

interface AgentDocItemProps {
  agentId: ExternalAgentId;
  showCopy?: boolean;
  className?: string;
}

const AgentDocItem = memo<AgentDocItemProps>(
  ({ agentId, showCopy = true, className }) => {
    const command = getAgentConnectionCommand(agentId);
    const displayName = getAgentDisplayName(agentId);
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
      navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center gap-2">
          <BotIcon className="h-4 w-4" />
          <span className="font-medium text-sm">
            {displayName}
            {BETA_AGENTS.has(agentId) && (
              <span className="text-gray-400 ml-1">(beta)</span>
            )}
          </span>
        </div>
        <div className="bg-gray-800 rounded-md p-2 border border-gray-700">
          <div className="flex items-start gap-2 text-xs">
            <TerminalIcon className="h-4 w-4 mt-0.5 text-gray-400 flex-shrink-0" />
            <code className="text-xs font-mono break-words flex-1 whitespace-pre-wrap text-gray-300">
              {command}
            </code>
            {showCopy && (
              <Button
                size="xs"
                variant="outline"
                className="border flex-shrink-0"
                onClick={handleCopy}
              >
                <CopyIcon className="h-3 w-3" />
                {copied && <span className="ml-1 text-green-600">Copied!</span>}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }
);
AgentDocItem.displayName = "AgentDocItem";

interface AgentDocsProps {
  title?: string;
  description?: React.ReactNode;
  agents?: ExternalAgentId[];
  showCopy?: boolean;
  className?: string;
}

export const AgentDocs = memo<AgentDocsProps>(
  ({
    title,
    description,
    agents = getAllAgentIds(),
    showCopy = true,
    className,
  }) => (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <h3 className="font-medium text-sm">{title}</h3>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
      <div className="space-y-3">
        {agents.map((agentId) => (
          <AgentDocItem key={agentId} agentId={agentId} showCopy={showCopy} />
        ))}
      </div>
    </div>
  )
);
AgentDocs.displayName = "AgentDocs";
