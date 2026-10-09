"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";

import { TextButton } from "@/components/actions/text-button";
import { cn } from "cn";

type ActionLineHeight = "compact" | "regular" | "relaxed";

const actionLineHeightClasses: Record<ActionLineHeight, { container: string; button: string }> = {
  compact: { container: "h-5", button: "leading-5" },
  regular: { container: "h-6", button: "leading-6" },
  relaxed: { container: "h-7", button: "leading-7" },
};

type TextClampProps = {
  /** How many lines show before the text is cut; the action reveals the rest. */
  lines?: number;
  /** The action that expands the text, set by the caller's locale. */
  more: string;
  /** The action that collapses it again, set by the caller's locale. */
  less: string;
  /** The text content to clamp, such as a paragraph or a list. */
  children: React.ReactNode;
};

/**
 * A block of prose held to a fixed number of lines, such as what a solution says of itself. When
 * the content is longer than the room it gets, the action sits at the end of the last visible line
 * to open it, and under it to close it again. Content that fits shows no action.
 */
function TextClamp({ lines = 5, more, less, children }: TextClampProps) {
  const body = useRef<HTMLDivElement>(null);
  const [clipped, setClipped] = useState(false);
  const [open, setOpen] = useState(false);
  const [actionLineHeight, setActionLineHeight] = useState<ActionLineHeight>("regular");

  useEffect(() => {
    const node = body.current;
    if (node === null) {
      return;
    }
    const measure = () => {
      const text = node.firstElementChild ?? node;
      const lineHeight = Number.parseFloat(getComputedStyle(text).lineHeight);
      if (Number.isFinite(lineHeight)) {
        setActionLineHeight(
          lineHeight <= 21 ? "compact" : lineHeight <= 25 ? "regular" : "relaxed",
        );
      }
      if (!open) {
        setClipped(node.scrollHeight > node.clientHeight);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (node.firstElementChild !== null) {
      observer.observe(node.firstElementChild);
    }
    return () => observer.disconnect();
  }, [children, lines, open]);

  // Keep the clamp in place while closed, even when this text fits. That lets the browser report
  // real overflow (`scrollHeight` versus `clientHeight`) without estimating a line height.
  const collapsed = !open;
  const actionClasses = actionLineHeightClasses[actionLineHeight];

  return (
    <div className="relative">
      <div
        ref={body}
        style={{ "--clamp": lines } as React.CSSProperties}
        className={collapsed ? "line-clamp-(--clamp)" : undefined}
      >
        {children}
      </div>
      {clipped &&
        (collapsed ? (
          <div
            className={cn(
              "pointer-events-none absolute right-0 bottom-0 flex items-center justify-end bg-linear-to-l from-background via-background to-transparent pl-16",
              actionClasses.container,
            )}
          >
            <TextButton
              size="md"
              onClick={() => setOpen(true)}
              className={cn("pointer-events-auto", actionClasses.button)}
            >
              {more}
            </TextButton>
          </div>
        ) : (
          <TextButton size="sm" onClick={() => setOpen(false)} className="mt-1 ml-auto">
            {less}
          </TextButton>
        ))}
    </div>
  );
}

export { TextClamp };
