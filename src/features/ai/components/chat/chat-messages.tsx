import { Plus } from "@phosphor-icons/react";
import { forwardRef, memo, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { SkillsCommand } from "@/features/ai/components/skills/skills-command";
import { hasPlanBlock } from "@/features/ai/lib/plan-parser";
import { dispatchAIChatSkillInsert } from "@/features/ai/lib/skill-events";
import type { ChatAcpEvent } from "@/features/ai/types/chat-ui";
import type { AIChatSkill } from "@/features/ai/types/skills";
import { useSettingsStore } from "@/features/settings/store";
import { Button } from "@/ui/button";
import { useAIChatStore } from "../../store/store";
import { AcpInlineEvent } from "./acp-inline-event";
import { ChatMessage } from "./chat-message";

interface ChatMessagesProps {
  onApplyCode?: (code: string, language?: string) => void;
  acpEvents?: ChatAcpEvent[];
}

const getTimestampMs = (value: Date | string): number => {
  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const ChatMessages = memo(
  forwardRef<HTMLDivElement, ChatMessagesProps>(function ChatMessages(
    { onApplyCode, acpEvents },
    ref,
  ) {
    const { currentChatId, chats } = useAIChatStore(
      useShallow((state) => ({
        currentChatId: state.currentChatId,
        chats: state.chats,
      })),
    );
    const skills = useSettingsStore((state) => state.settings.aiSkills);
    const [isSkillsOpen, setIsSkillsOpen] = useState(false);
    const [skillsInitialView, setSkillsInitialView] = useState<"list" | "editor">("list");

    const currentChat = useMemo(
      () => chats.find((chat) => chat.id === currentChatId),
      [chats, currentChatId],
    );
    const messages = currentChat?.messages || [];
    const timelineItems = useMemo(
      () =>
        [
          ...messages.map((message, messageIndex) => ({
            id: `message-${message.id}`,
            type: "message" as const,
            timestamp: getTimestampMs(message.timestamp),
            order: messageIndex,
            message,
            messageIndex,
          })),
          ...(acpEvents || []).map((event, eventIndex) => ({
            id: `acp-${event.id}`,
            type: "acp" as const,
            timestamp: getTimestampMs(event.timestamp),
            order: messages.length + eventIndex,
            event,
          })),
        ].sort((a, b) => {
          if (a.timestamp !== b.timestamp) {
            return a.timestamp - b.timestamp;
          }

          return a.order - b.order;
        }),
      [messages, acpEvents],
    );

    const visibleSkills = useMemo(
      () =>
        [...skills].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 8),
      [skills],
    );

    const openNewSkill = () => {
      setSkillsInitialView("editor");
      setIsSkillsOpen(true);
    };

    const handleSkillSelect = (skill: AIChatSkill) => {
      dispatchAIChatSkillInsert(skill);
    };

    if (messages.length === 0) {
      return (
        <div className="flex h-full flex-col justify-end px-4 pb-6 pt-4">
          <div className="mx-auto w-full max-w-sm rounded-xl border border-dashed border-border/70 bg-secondary-bg/20 p-2.5">
            {visibleSkills.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {visibleSkills.map((skill) => (
                  <Button
                    key={skill.id}
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => handleSkillSelect(skill)}
                    className="h-6 max-w-full rounded-full border border-dashed border-border/70 bg-primary-bg/35 px-2 text-text-lighter hover:border-border-strong hover:bg-hover/60 hover:text-text"
                    tooltip={skill.title}
                    aria-label={`Use skill ${skill.title}`}
                  >
                    <span className="min-w-0 truncate">{skill.title}</span>
                  </Button>
                ))}
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={openNewSkill}
                className="h-7 w-full justify-center rounded-lg border border-dashed border-border/70 bg-primary-bg/25 text-text-lighter hover:border-border-strong hover:bg-hover/60 hover:text-text"
              >
                <Plus />
                <span>Add skill</span>
              </Button>
            )}
          </div>
          <SkillsCommand
            isOpen={isSkillsOpen}
            initialView={skillsInitialView}
            onClose={() => setIsSkillsOpen(false)}
            onSelectSkill={handleSkillSelect}
          />
        </div>
      );
    }

    return (
      <>
        {timelineItems.map((item) => {
          if (item.type === "acp") {
            return <AcpInlineEvent key={item.id} event={item.event} />;
          }

          const message = item.message;
          const index = item.messageIndex;
          const prevMessage = index > 0 ? messages[index - 1] : null;
          const isToolOnlyMessage =
            message.role === "assistant" &&
            message.toolCalls &&
            message.toolCalls.length > 0 &&
            (!message.content || message.content.trim().length === 0);
          const previousMessageIsToolOnly =
            prevMessage &&
            prevMessage.role === "assistant" &&
            prevMessage.toolCalls &&
            prevMessage.toolCalls.length > 0 &&
            (!prevMessage.content || prevMessage.content.trim().length === 0);

          const isPlanMessage = message.role === "assistant" && hasPlanBlock(message.content);
          const messageClassName = [
            isToolOnlyMessage
              ? previousMessageIsToolOnly
                ? "px-4 py-1"
                : "px-4 pt-2 pb-1"
              : "px-4 py-2",
            isPlanMessage ? "pt-2" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div key={item.id} className={messageClassName}>
              <ChatMessage
                message={message}
                isLastMessage={index === messages.length - 1}
                onApplyCode={onApplyCode}
              />
            </div>
          );
        })}
        <div ref={ref} />
      </>
    );
  }),
);
