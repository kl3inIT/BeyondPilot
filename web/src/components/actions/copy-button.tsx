"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import type { ActionProminence, ActionSize } from "@/components/actions/action-styles";
import { Button } from "@/components/actions/button";
import { IconButton } from "@/components/actions/icon-button";
import { useNotify } from "@/hooks/use-notify";
import { cn } from "@/lib/utils";

/** How long the control says it copied, in milliseconds. */
const COPIED_MS = 1500;

type CopyButtonProps = {
  /** The text that goes to the clipboard. */
  value: string;
  /**
   * What the control does, in the caller's words: the text of a button with words ("Copy"), the name
   * of one that is an icon alone ("Copy the host").
   */
  label: string;
  /** With words, beside a field that shows the value; an icon alone, beside a value in a row. */
  appearance?: "label" | "icon";
  prominence?: ActionProminence;
  size?: ActionSize;
  className?: string;
};

/**
 * Copies a text to the clipboard, the one control for it. For a moment it shows that it copied, and
 * says "Copied" in a live region, since a label or an icon that changes under the focus is not read
 * out. A button with words keeps the width of the longer of its two labels, so nothing beside it
 * moves. A browser that refuses the clipboard (no permission, a page that is not secure) is told in
 * a toast with what to do instead, never passed over in silence.
 */
function CopyButton({
  value,
  label,
  appearance = "label",
  prominence,
  size,
  className,
}: CopyButtonProps) {
  const t = useTranslations("Actions");
  const notify = useNotify();
  const [copied, setCopied] = useState(false);
  const reset = useRef<number>(undefined);

  useEffect(() => () => window.clearTimeout(reset.current), []);

  async function copy() {
    try {
      // Without a clipboard to write to, this throws as a refusal does.
      await navigator.clipboard.writeText(value);
    } catch {
      notify.error("Actions.copyFailed");
      return;
    }
    setCopied(true);
    window.clearTimeout(reset.current);
    reset.current = window.setTimeout(() => setCopied(false), COPIED_MS);
  }

  // Outside the button, whose content is its name; empty until there is something to say.
  const said = (
    <span role="status" className="sr-only">
      {copied ? t("copied") : ""}
    </span>
  );

  if (appearance === "icon") {
    return (
      <>
        <IconButton
          aria-label={label}
          prominence={prominence ?? "tertiary"}
          size={size ?? "sm"}
          className={className}
          onClick={copy}
        >
          {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
        </IconButton>
        {said}
      </>
    );
  }

  return (
    <>
      <Button
        prominence={prominence ?? "secondary"}
        size={size}
        className={className}
        onClick={copy}
      >
        {/* Both labels share one cell, so the button is as wide as the longer; one shows at a time. */}
        <span className="grid">
          <span
            aria-hidden={copied || undefined}
            className={cn("col-start-1 row-start-1", copied && "invisible")}
          >
            {label}
          </span>
          <span
            aria-hidden={!copied || undefined}
            className={cn("col-start-1 row-start-1", !copied && "invisible")}
          >
            {t("copied")}
          </span>
        </span>
      </Button>
      {said}
    </>
  );
}

export { CopyButton, type CopyButtonProps };
