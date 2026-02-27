/* Crow IDE ACP Common Components */
import type { RequestPermissionResponse } from "@zed-industries/agent-client-protocol";
import {
  CheckCircleIcon,
  Loader2,
  PlugIcon,
  ShieldCheckIcon,
  WifiIcon,
  WifiOffIcon,
  XCircleIcon,
} from "lucide-react";
import React, { memo } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { cn } from "./adapters";
import type { AgentPendingPermission } from "./types";

interface SimpleAccordionProps {
  title: string | React.ReactNode;
  children: React.ReactNode | string;
  status?: "loading" | "error" | "success";
  index?: number;
  defaultIcon?: React.ReactNode;
  durationMs?: number;
}

export const SimpleAccordion: React.FC<SimpleAccordionProps> = ({
  title,
  children,
  status,
  index = 0,
  defaultIcon,
  durationMs,
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case "loading":
        return <Loader2 className="h-3 w-3 animate-spin text-yellow-400" />;
      case "error":
        return <XCircleIcon className="h-3 w-3 text-red-500" />;
      case "success":
        return <CheckCircleIcon className="h-3 w-3 text-green-500" />;
      default:
        return defaultIcon;
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  return (
    <Accordion
      key={`tool-${index}`}
      type="single"
      collapsible={true}
      className="w-full"
    >
      <AccordionItem value="tool-call" className="border-0">
        <AccordionTrigger
          className={cn(
            "py-1.5 text-xs border border-gray-700 bg-gray-800/80 hover:bg-gray-700 px-2 gap-1 rounded-md [&[data-state=open]>svg]:rotate-180 transition-all",
            status === "error" && "border-red-700/50 bg-red-900/20 text-red-400/80",
            status === "success" && "border-green-700/30 text-gray-300",
            status === "loading" && "border-yellow-700/30 bg-yellow-900/10"
          )}
        >
          <span className="flex items-center gap-1.5 flex-1 min-w-0">
            {getStatusIcon()}
            <code className="font-mono text-xs truncate flex-1">{title}</code>
            {durationMs !== undefined && status === "success" && (
              <span className="text-[10px] text-gray-500 font-normal ml-auto shrink-0">
                {formatDuration(durationMs)}
              </span>
            )}
          </span>
        </AccordionTrigger>
        <AccordionContent className="p-2">
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {status !== "error" && (
              <div className="text-xs font-medium text-gray-400 mb-1">
                {children}
              </div>
            )}

            {status === "error" && (
              <div className="bg-red-900/30 border border-red-700 rounded-md p-3 text-xs text-red-400">
                {children}
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

interface ConnectionStatusProps {
  status: string;
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = memo(
  ({ status, className }) => {
    const getStatusConfig = () => {
      switch (status) {
        case "connected":
          return {
            icon: <WifiIcon className="h-3 w-3" />,
            label: "Connected",
            variant: "default" as const,
            extraClassName: "bg-blue-900/50 text-blue-300 border-blue-700",
          };
        case "connecting":
          return {
            icon: <PlugIcon className="h-3 w-3 animate-pulse" />,
            label: "Connecting",
            variant: "secondary" as const,
            extraClassName: "bg-yellow-900/50 text-yellow-300 border-yellow-700",
          };
        case "disconnected":
          return {
            icon: <WifiOffIcon className="h-3 w-3" />,
            label: "Disconnected",
            variant: "outline" as const,
            extraClassName: "bg-red-900/50 text-red-300 border-red-700",
          };
        default:
          return {
            icon: <WifiOffIcon className="h-3 w-3" />,
            label: status || "Unknown",
            variant: "outline" as const,
            extraClassName: "bg-gray-800 text-gray-300 border-gray-700",
          };
      }
    };

    const config = getStatusConfig();

    return (
      <Badge
        variant={config.variant}
        className={cn(config.extraClassName, className)}
      >
        {config.icon}
        <span className="ml-1 text-xs font-medium">{config.label}</span>
      </Badge>
    );
  }
);
ConnectionStatus.displayName = "ConnectionStatus";

interface PermissionRequestProps {
  permission: NonNullable<AgentPendingPermission>;
  onResolve: (option: RequestPermissionResponse) => void;
}

export const PermissionRequest: React.FC<PermissionRequestProps> = memo(
  ({ permission, onResolve }) => {
    return (
      <div className="border border-amber-700 bg-amber-900/30 rounded-lg p-2">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheckIcon className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-medium text-amber-300">
            Permission Request
          </h3>
        </div>
        <p className="text-sm text-amber-300 mb-3">
          The AI agent is requesting permission to proceed:
        </p>
        <div className="text-xs text-gray-300 mb-3 p-2 bg-gray-800 rounded border border-gray-700">
          <pre className="whitespace-pre-wrap">
            {JSON.stringify(permission.toolCall, null, 2)}
          </pre>
        </div>
        <div className="flex gap-2">
          {permission.options.map((option) => (
            <Button
              key={option.optionId}
              size="xs"
              variant="text"
              className={
                option.kind.startsWith("allow")
                  ? "text-blue-400"
                  : "text-red-400"
              }
              onClick={() =>
                onResolve({
                  outcome: {
                    outcome: "selected",
                    optionId: option.optionId,
                  },
                })
              }
            >
              {option.kind.startsWith("allow") && (
                <CheckCircleIcon className="h-3 w-3 mr-1" />
              )}
              {option.kind.startsWith("reject") && (
                <XCircleIcon className="h-3 w-3 mr-1" />
              )}
              {option.name}
            </Button>
          ))}
        </div>
      </div>
    );
  }
);
PermissionRequest.displayName = "PermissionRequest";
