import {
  WarningCircle as AlertCircle,
  CheckCircle as CheckCircle2,
  Clock as Clock3,
  Key as KeyRound,
  Sparkle as Sparkles,
  Wrench,
} from "@phosphor-icons/react";
import type { ChatAcpEvent } from "@/features/ai/types/chat-ui";
import { cn } from "@/utils/cn";

interface AcpInlineEventProps {
  event: ChatAcpEvent;
}

function getEventIcon(event: ChatAcpEvent) {
  if (event.kind === "tool") return Wrench;
  if (event.kind === "permission") return KeyRound;
  if (event.kind === "thinking") return Sparkles;
  if (event.state === "error") return AlertCircle;
  if (event.state === "success") return CheckCircle2;
  return Clock3;
}

export function AcpInlineEvent({ event }: AcpInlineEventProps) {
  const Icon = getEventIcon(event);
  const text = event.detail ? `${event.label}: ${event.detail}` : event.label;

  return (
    <div className="px-4 py-1.5">
      <div className="ui-font ui-text-xs flex items-center gap-2 text-text-lighter">
        <Icon
          className={cn(
            "shrink-0",
            event.state === "running" && "text-text-lighter/70",
            event.state === "success" && "text-success/75",
            event.state === "error" && "text-error/80",
            (!event.state || event.state === "info") && "text-text-lighter/70",
          )}
        />
        <div className="min-w-0 truncate">
          <span className="font-medium text-text/90">{text}</span>
        </div>
      </div>
    </div>
  );
}
