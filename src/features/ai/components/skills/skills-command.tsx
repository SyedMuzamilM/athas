import {
  CloudArrowDown,
  FloppyDisk,
  MagnifyingGlass as Search,
  PencilSimple,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { fuzzyScore } from "@/features/global-search/utils/fuzzy-search";
import { useSettingsStore } from "@/features/settings/store";
import { useSettingsSyncStore } from "@/features/settings/stores/settings-sync-store";
import type { AIChatSkill } from "@/features/ai/types/skills";
import { Button } from "@/ui/button";
import Command, {
  CommandEmpty,
  CommandHeader,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/ui/command";
import Input from "@/ui/input";
import Textarea from "@/ui/textarea";
import { cn } from "@/utils/cn";

interface SkillsCommandProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSkill: (skill: AIChatSkill) => void;
  initialView?: SkillsView;
}

type SkillsView = "list" | "editor";

function createSkillId() {
  return `skill-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getSyncLabel(enabled: boolean, status: string) {
  if (!enabled) return "Local only";
  if (status === "syncing") return "Syncing";
  if (status === "error") return "Sync paused";
  return "Account sync";
}

export function SkillsCommand({
  isOpen,
  onClose,
  onSelectSkill,
  initialView = "list",
}: SkillsCommandProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [view, setView] = useState<SkillsView>("list");
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const skills = useSettingsStore((state) => state.settings.aiSkills);
  const updateSetting = useSettingsStore((state) => state.updateSetting);
  const syncEnabled = useSettingsSyncStore((state) => state.enabled);
  const syncStatus = useSettingsSyncStore((state) => state.status);

  const filteredSkills = useMemo(() => {
    const normalizedQuery = deferredQuery.trim();
    const sortedSkills = [...skills].sort(
      (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    );

    if (!normalizedQuery) {
      return sortedSkills;
    }

    return sortedSkills
      .map((skill) => ({
        skill,
        score:
          fuzzyScore(skill.title, normalizedQuery) * 2 + fuzzyScore(skill.content, normalizedQuery),
      }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((result) => result.skill);
  }, [deferredQuery, skills]);

  const resetEditor = useCallback(() => {
    setEditingSkillId(null);
    setTitle("");
    setContent("");
  }, []);

  const openNewSkill = useCallback(() => {
    resetEditor();
    setView("editor");
    requestAnimationFrame(() => titleInputRef.current?.focus());
  }, [resetEditor]);

  const openBrowseSkills = useCallback(() => {
    void openUrl("https://skills.sh");
  }, []);

  const openSkillEditor = useCallback((skill: AIChatSkill) => {
    setEditingSkillId(skill.id);
    setTitle(skill.title);
    setContent(skill.content);
    setView("editor");
    requestAnimationFrame(() => titleInputRef.current?.focus());
  }, []);

  const closeEditor = useCallback(() => {
    resetEditor();
    setView("list");
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [resetEditor]);

  const handleClose = useCallback(() => {
    setView("list");
    resetEditor();
    onClose();
  }, [onClose, resetEditor]);

  const handleSave = useCallback(async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const now = new Date().toISOString();
    const nextSkills = editingSkillId
      ? skills.map((skill) =>
          skill.id === editingSkillId
            ? { ...skill, title: trimmedTitle, content, updatedAt: now }
            : skill,
        )
      : [
          {
            id: createSkillId(),
            title: trimmedTitle,
            content,
            createdAt: now,
            updatedAt: now,
          },
          ...skills,
        ];

    await updateSetting("aiSkills", nextSkills);
    closeEditor();
  }, [closeEditor, content, editingSkillId, skills, title, updateSetting]);

  const handleDelete = useCallback(
    async (skillId: string) => {
      await updateSetting(
        "aiSkills",
        skills.filter((skill) => skill.id !== skillId),
      );
      setSelectedIndex(0);
    },
    [skills, updateSetting],
  );

  const handleSelectSkill = useCallback(
    (skill: AIChatSkill) => {
      onSelectSkill(skill);
      handleClose();
    },
    [handleClose, onSelectSkill],
  );

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setSelectedIndex(0);
    resetEditor();
    setView(initialView);
    requestAnimationFrame(() => {
      if (initialView === "editor") {
        titleInputRef.current?.focus();
        return;
      }
      inputRef.current?.focus();
    });
  }, [initialView, isOpen, resetEditor]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [deferredQuery]);

  useEffect(() => {
    if (!isOpen || view !== "list") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "Escape":
          event.preventDefault();
          handleClose();
          break;
        case "ArrowDown":
          event.preventDefault();
          setSelectedIndex((current) =>
            filteredSkills.length === 0 ? 0 : Math.min(current + 1, filteredSkills.length - 1),
          );
          break;
        case "ArrowUp":
          event.preventDefault();
          setSelectedIndex((current) => Math.max(current - 1, 0));
          break;
        case "Enter":
          if (filteredSkills[selectedIndex]) {
            event.preventDefault();
            handleSelectSkill(filteredSkills[selectedIndex]);
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [filteredSkills, handleClose, handleSelectSkill, isOpen, selectedIndex, view]);

  useEffect(() => {
    if (!resultsRef.current || filteredSkills.length === 0) return;
    const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement | undefined;
    selectedElement?.scrollIntoView({ block: "nearest" });
  }, [filteredSkills.length, selectedIndex]);

  const canSave = title.trim().length > 0;

  return (
    <Command isVisible={isOpen} onClose={handleClose}>
      {view === "list" ? (
        <>
          <CommandHeader onClose={handleClose}>
            <Search className="shrink-0 text-text-lighter" size={14} />
            <CommandInput
              ref={inputRef}
              value={query}
              onChange={setQuery}
              placeholder="Search skills..."
            />
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={openNewSkill}
              className="shrink-0 ui-text-sm"
            >
              <Plus />
              <span>New skill</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={openBrowseSkills}
              className="shrink-0 ui-text-sm"
            >
              <CloudArrowDown />
              <span>Browse</span>
            </Button>
          </CommandHeader>

          <CommandList ref={resultsRef}>
            {skills.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
                <CommandEmpty>No skills yet</CommandEmpty>
                <Button type="button" variant="secondary" size="xs" onClick={openNewSkill}>
                  <Plus />
                  <span>New skill</span>
                </Button>
                <Button type="button" variant="ghost" size="xs" onClick={openBrowseSkills}>
                  <CloudArrowDown />
                  <span>Browse skills</span>
                </Button>
              </div>
            ) : filteredSkills.length === 0 ? (
              <CommandEmpty>No skills match "{query}"</CommandEmpty>
            ) : (
              filteredSkills.map((skill, index) => {
                const isSelected = selectedIndex === index;
                const preview = skill.content.trim().replace(/\s+/g, " ");

                return (
                  <CommandItem
                    key={skill.id}
                    isSelected={isSelected}
                    onClick={() => handleSelectSkill(skill)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className="group mb-1 px-3 py-2 last:mb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs text-text">{skill.title}</div>
                      {preview && (
                        <div className="mt-0.5 truncate text-[11px] text-text-lighter">
                          {preview}
                        </div>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        openSkillEditor(skill);
                      }}
                      className="opacity-0 focus:opacity-100 group-hover:opacity-100"
                      tooltip="Edit skill"
                      aria-label={`Edit ${skill.title}`}
                    >
                      <PencilSimple size={13} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDelete(skill.id);
                      }}
                      className="opacity-0 hover:bg-red-500/10 hover:text-red-400 focus:opacity-100 group-hover:opacity-100"
                      tooltip="Delete skill"
                      aria-label={`Delete ${skill.title}`}
                    >
                      <Trash size={13} />
                    </Button>
                  </CommandItem>
                );
              })
            )}
          </CommandList>

          <div className="border-border border-t px-4 py-2 text-[11px] text-text-lighter">
            {getSyncLabel(syncEnabled, syncStatus)}
          </div>
        </>
      ) : (
        <>
          <CommandHeader onClose={handleClose}>
            <div className="min-w-0 flex-1">
              <div className="ui-font ui-text-sm truncate text-text">
                {editingSkillId ? "Edit skill" : "New skill"}
              </div>
            </div>
          </CommandHeader>

          <div className="custom-scrollbar-thin flex-1 space-y-3 overflow-y-auto p-3">
            <div className="space-y-1.5">
              <label className="ui-font ui-text-sm text-text-lighter" htmlFor="ai-skill-title">
                Title
              </label>
              <Input
                id="ai-skill-title"
                ref={titleInputRef}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Code review checklist"
                maxLength={120}
                size="sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="ui-font ui-text-sm text-text-lighter" htmlFor="ai-skill-content">
                Markdown
              </label>
              <Textarea
                id="ai-skill-content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Write the instructions or reusable context for this skill..."
                className="min-h-36 resize-none"
                size="sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-border border-t px-3 py-2">
            <Button type="button" variant="ghost" size="xs" onClick={closeEditor}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="xs"
              onClick={() => void handleSave()}
              disabled={!canSave}
              className={cn(!canSave && "opacity-50")}
            >
              <FloppyDisk />
              <span>Save skill</span>
            </Button>
          </div>
        </>
      )}
    </Command>
  );
}
