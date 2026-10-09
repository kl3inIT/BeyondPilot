"use client";

import { cn } from "cn";
import type React from "react";
import { cloneElement, useEffect, useRef, useState } from "react";

type TextClampProps = {
  /** How many lines show before the text is cut; the action reveals the rest. */
  lines?: number;
  /** The action that expands the text, set by the caller's locale. */
  more: string;
  /** The action that collapses it again, set by the caller's locale. */
  less: string;
  /** The single element holding the text, such as a paragraph or a list. */
  children: React.ReactElement<
    { className?: string; style?: React.CSSProperties } & React.RefAttributes<HTMLElement>
  >;
};

/**
 * A block of prose held to a fixed number of lines, such as what a solution says of itself. When
 * the content is longer than the room it gets, the action sits at the end of the last visible line
 * to open it, and under it to close it again. Content that fits shows no action.
 */
function TextClamp({ lines = 5, more, less, children }: TextClampProps) {
  const body = useRef<HTMLElement>(null);
  const [clipped, setClipped] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const node = body.current;
    if (node === null) {
      return;
    }
    const measure = () => {
      const lineHeight = parseFloat(getComputedStyle(node).lineHeight) || 20;
      setClipped(node.scrollHeight > lines * lineHeight + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [lines]);

  const collapsed = clipped && !open;

  return (
    <div className="relative">
      {cloneElement(children, {
        ref: body,
        style: { "--clamp": lines } as React.CSSProperties,
        className: cn(children.props.className, collapsed && "line-clamp-(--clamp)"),
      })}
      {clipped &&
        (collapsed ? (
          <div className="pointer-events-none absolute right-0 bottom-0 flex h-6 items-center justify-end bg-linear-to-l from-background via-background to-transparent pl-16">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="group/badge pointer-events-auto hit-area inline-flex h-6 w-fit shrink-0 cursor-pointer items-center justify-center gap-1 rounded-full border border-input bg-background px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-foreground shadow-sm transition-all hover:bg-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {more}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="group/badge hit-area mt-1 ml-auto flex h-6 w-fit shrink-0 cursor-pointer items-center justify-center gap-1 rounded-full border border-input px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-foreground transition-all hover:bg-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {less}
          </button>
        ))}
    </div>
  );
}

export { TextClamp };
