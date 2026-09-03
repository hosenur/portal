import { DocumentIcon } from "@/components/icons/lucide";
import { useEffect, useRef, useState } from "react";
import useMediaQuery from "@/hooks/use-media-query";
import { useInstanceStore } from "@/stores/instance-store";
import { backendBasePath } from "@/lib/backend-url";
import type { Agent } from "@opencode-ai/sdk/v2";
import {
  SubagentMentionRows,
  subagentResults,
  type MentionResult,
} from "@/components/subagent-mention";

interface FileResult {
  path: string;
  name: string;
}

interface CaretPosition {
  top: number;
  left: number;
}

function getCaretCoordinates(
  element: HTMLTextAreaElement,
  position: number,
): CaretPosition {
  const div = document.createElement("div");
  const style = getComputedStyle(element);

  const properties = [
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "letterSpacing",
    "textTransform",
    "wordSpacing",
    "textIndent",
    "whiteSpace",
    "wordWrap",
    "overflowWrap",
    "lineHeight",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "boxSizing",
  ] as const;

  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";
  div.style.width = `${element.offsetWidth}px`;

  for (const prop of properties) {
    div.style[prop] = style[prop];
  }

  document.body.appendChild(div);

  const text = element.value.substring(0, position);
  div.textContent = text;

  const span = document.createElement("span");
  span.textContent = element.value.substring(position) || ".";
  div.appendChild(span);

  const rect = element.getBoundingClientRect();
  const spanRect = span.getBoundingClientRect();
  const divRect = div.getBoundingClientRect();

  document.body.removeChild(div);

  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  let top = rect.top + (spanRect.top - divRect.top) - element.scrollTop;
  let left = rect.left + (spanRect.left - divRect.left) - element.scrollLeft;

  const isMobileDevice = window.innerWidth < 768;
  if (isMobileDevice) {
    const keyboardHeight = viewportHeight * 0.4;
    const availableSpace = rect.top - keyboardHeight;

    if (availableSpace < 200) {
      top =
        rect.bottom +
        (spanRect.bottom - divRect.bottom) +
        element.scrollTop +
        8;
    }

    left = Math.max(16, Math.min(left, viewportWidth - 320));
  }

  return { top, left };
}

interface FileMentionPopoverProps {
  isOpen: boolean;
  searchQuery: string;
  onSelect: (value: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  mentionStart: number | null;
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
  onResultsChange?: (results: MentionResult[]) => void;
  onClose: () => void;
  agents?: Agent[];
}

export function FileMentionPopover({
  isOpen,
  searchQuery,
  onSelect,
  textareaRef,
  mentionStart,
  selectedIndex,
  onSelectedIndexChange,
  onResultsChange,
  onClose,
  agents = [],
}: FileMentionPopoverProps) {
  const [files, setFiles] = useState<FileResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState<CaretPosition | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const { isMobile } = useMediaQuery();
  const instance = useInstanceStore((s) => s.instance);
  const port = instance?.port;
  const apiBase = port ? backendBasePath(instance?.provider, port) : "";

  const agentResults = subagentResults(agents, searchQuery);
  const totalResults = agentResults.length + files.length;

  useEffect(() => {
    if (isOpen && mentionStart !== null && textareaRef.current) {
      const coords = getCaretCoordinates(textareaRef.current, mentionStart);

      if (
        coords.top <= 0 ||
        coords.left < 0 ||
        !Number.isFinite(coords.top) ||
        !Number.isFinite(coords.left)
      ) {
        const rect = textareaRef.current.getBoundingClientRect();
        setPosition({
          top: rect.top,
          left: Math.max(16, rect.left),
        });
      } else {
        setPosition(coords);
      }
    } else {
      setPosition(null);
    }
  }, [isOpen, mentionStart, textareaRef]);

  useEffect(() => {
    if (!isOpen || !searchQuery || !port) {
      setFiles([]);
      onResultsChange?.(subagentResults(agents, searchQuery));
      return;
    }

    const controller = new AbortController();
    const fetchFiles = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `${apiBase}/files/search?q=${encodeURIComponent(searchQuery)}`,
          { signal: controller.signal },
        );
        if (response.ok) {
          const data = await response.json();
          const fileList = (data.data || data || []) as string[];
          const mappedFiles = fileList.slice(0, 10).map((path: string) => ({
            path,
            name: path.split("/").pop() || path,
          }));
          setFiles(mappedFiles);
          onResultsChange?.([
            ...subagentResults(agents, searchQuery),
            ...mappedFiles.map((f) => ({ type: "file" as const, value: f.path })),
          ]);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Failed to fetch files:", err);
        }
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchFiles, 150);
    return () => {
      clearTimeout(debounceTimer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, searchQuery, port, apiBase, agents, onResultsChange]);

  useEffect(() => {
    if (listRef.current && totalResults > 0) {
      const selectedElement = listRef.current.children[
        selectedIndex
      ] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex, totalResults]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen, onClose, textareaRef]);

  const renderRows = (hoverClassName: string) => (
    <>
      <SubagentMentionRows
        agents={agents}
        query={searchQuery}
        selectedIndex={selectedIndex}
        onSelect={onSelect}
        onSelectedIndexChange={onSelectedIndexChange}
      />

      {agentResults.length > 0 && files.length > 0 && (
        <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-fg/60">
          Files
        </div>
      )}

      {files.map((file, index) => {
        const absIndex = agentResults.length + index;
        const isSelected = absIndex === selectedIndex;
        return (
          <button
            type="button"
            key={file.path}
            className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-all duration-150 ${
              isSelected ? "bg-primary/10 text-primary-fg" : hoverClassName
            }`}
            onClick={() => onSelect(file.path)}
            onMouseEnter={() => onSelectedIndexChange(absIndex)}
            onTouchEnd={() => onSelect(file.path)}
          >
            <div
              className={`flex shrink-0 items-center justify-center rounded-md p-1.5 ${
                isSelected ? "bg-primary text-primary-fg" : "bg-muted text-muted-fg"
              }`}
            >
              <DocumentIcon className="size-4" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span
                className={`font-medium truncate leading-tight ${
                  isSelected ? "text-primary-fg" : "text-foreground"
                }`}
              >
                {file.name}
              </span>
              <span
                className={`text-[10px] truncate leading-tight ${
                  isSelected ? "text-primary-fg/70" : "text-muted-fg/70"
                }`}
              >
                {file.path}
              </span>
            </div>
          </button>
        );
      })}
    </>
  );

  if (!isOpen) return null;
  if (!isMobile && !position) return null;

  if (isMobile) {
    return (
      <div
        ref={popoverRef}
        className="absolute bottom-full left-5 right-5 mb-3 z-50 rounded-xl border border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200"
      >
        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-fg/80 border-b border-border/40 bg-muted/20 rounded-t-xl">
          {loading ? "Searching..." : `Matching "${searchQuery}"`}
        </div>
        <div
          ref={listRef}
          className="max-h-56 overflow-y-auto p-1.5 scrollbar-hide"
        >
          {totalResults === 0 && (
            <div className="px-3 py-4 text-center text-sm text-muted-fg/60">
              {loading ? "Searching..." : "No matching agents or files"}
            </div>
          )}
          {renderRows(
            "hover:bg-muted/50 active:bg-muted/70 text-foreground",
          )}
        </div>
      </div>
    );
  }

  const desktopStyle: React.CSSProperties = {
    top: (position?.top ?? 0) - 10,
    left: Math.min(position?.left ?? 0, window.innerWidth - 320),
    transform: "translateY(-100%)",
  };

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 min-w-72 max-w-lg rounded-xl border border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-150 ease-out"
      style={desktopStyle}
    >
      <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-fg/80 border-b border-border/40 bg-muted/20 rounded-t-xl">
        {loading ? "Searching..." : `Matching "${searchQuery}"`}
      </div>
      <div
        ref={listRef}
        className="max-h-[300px] overflow-y-auto p-1.5 scrollbar-thin scrollbar-thumb-border/50 scrollbar-track-transparent"
      >
        {totalResults === 0 && (
          <div className="px-3 py-4 text-center text-sm text-muted-fg/60">
            {loading ? "Searching..." : "No matching agents or files"}
          </div>
        )}
{renderRows(
            "hover:bg-muted/50 text-foreground",
          )}
        </div>
      </div>
    );
  }

interface UseMentionResult {
  isOpen: boolean;
  searchQuery: string;
  selectedIndex: number;
  mentionStart: number | null;
  handleInputChange: (value: string, cursorPosition: number) => void;
  handleKeyDown: (e: React.KeyboardEvent, resultsCount: number) => boolean;
  handleSelect: (value: string, currentValue: string) => string;
  close: () => void;
  setSelectedIndex: (index: number) => void;
}

export function useFileMention(): UseMentionResult {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState<number | null>(null);

  const handleInputChange = (value: string, cursorPosition: number) => {
    const textBeforeCursor = value.slice(0, cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf("@");

    if (atIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(atIndex + 1);
      const charBeforeAt = atIndex > 0 ? textBeforeCursor[atIndex - 1] : " ";

      if (
        (charBeforeAt === " " || charBeforeAt === "\n" || atIndex === 0) &&
        !textAfterAt.includes(" ") &&
        !textAfterAt.includes("\n")
      ) {
        setSearchQuery(textAfterAt);
        setMentionStart(atIndex);
        setSelectedIndex(0);
        setIsOpen(true);
        return;
      }
    }

    close();
  };

  const handleKeyDown = (
    e: React.KeyboardEvent,
    resultsCount: number,
  ): boolean => {
    if (!isOpen) return false;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(resultsCount, 1));
        return true;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev - 1 < 0 ? Math.max(resultsCount - 1, 0) : prev - 1,
        );
        return true;
      case "Escape":
        e.preventDefault();
        close();
        return true;
      case "Tab":
      case "Enter":
        if (resultsCount > 0) {
          e.preventDefault();
          return true;
        }
        return false;
      default:
        return false;
    }
  };

  const handleSelect = (value: string, currentValue: string): string => {
    if (mentionStart === null) return currentValue;

    const beforeMention = currentValue.slice(0, mentionStart);
    const afterMention = currentValue.slice(
      mentionStart + 1 + searchQuery.length,
    );
    const newValue = `${beforeMention}@${value} ${afterMention}`;

    close();
    return newValue;
  };

  const close = () => {
    setIsOpen(false);
    setSearchQuery("");
    setMentionStart(null);
    setSelectedIndex(0);
  };

  return {
    isOpen,
    searchQuery,
    selectedIndex,
    mentionStart,
    handleInputChange,
    handleKeyDown,
    handleSelect,
    close,
    setSelectedIndex,
  };
}