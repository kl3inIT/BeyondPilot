"use client";

import { MonitorIcon, SmartphoneIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/**
 * An email as a mailbox shows it, in a sandboxed frame that runs nothing: the subject and the HTML the
 * backend rendered, at a desktop or a phone's width. The frame grows to the email's height.
 */
function EmailPreview({
  subject,
  html,
  title,
  behind,
  className,
}: {
  subject: string;
  html: string;
  /** What the preview shows, for the frame's accessible name. */
  title: string;
  /** Why the preview is not what is being typed, when it is not; it is then shown dimmed. */
  behind?: string;
  className?: string;
}) {
  const t = useTranslations("Admin.email.preview");
  const [width, setWidth] = useState<"desktop" | "phone">("desktop");
  const frame = useRef<HTMLIFrameElement>(null);

  // Sizes the frame to its content once the email has been laid out. A frame the server rendered
  // may have loaded before this runs, so it is sized at once as well as on load, and again when
  // the width chosen changes how the email wraps.
  useEffect(() => {
    const element = frame.current;
    if (!element) {
      return;
    }
    const fit = () => {
      const root = element.contentDocument?.documentElement;
      if (root) {
        element.style.height = `${root.scrollHeight}px`;
      }
    };
    fit();
    element.addEventListener("load", fit);
    return () => element.removeEventListener("load", fit);
  }, [html, width]);

  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border bg-muted/40 p-3 md:p-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{t("title")}</p>
        <ToggleGroup
          variant="outline"
          size="sm"
          spacing={0}
          aria-label={t("width")}
          value={[width]}
          onValueChange={(values) => {
            const next = values.at(-1);
            if (next === "desktop" || next === "phone") {
              setWidth(next);
            }
          }}
        >
          <ToggleGroupItem value="desktop" aria-label={t("desktop")}>
            <MonitorIcon aria-hidden="true" />
          </ToggleGroupItem>
          <ToggleGroupItem value="phone" aria-label={t("phone")}>
            <SmartphoneIcon aria-hidden="true" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      {behind && (
        <p role="status" className="rounded-md border bg-background px-3 py-2 text-xs font-medium">
          {behind}
        </p>
      )}
      <p
        className={cn(
          "truncate rounded-md border bg-background px-3 py-2 text-xs",
          behind && "opacity-60",
        )}
      >
        <span className="text-muted-foreground">{t("subject")} </span>
        <span className="font-medium">{subject}</span>
      </p>
      <div
        className={cn(
          "flex justify-center overflow-hidden rounded-md border bg-background",
          behind && "opacity-60",
        )}
      >
        <iframe
          ref={frame}
          title={title}
          srcDoc={html}
          sandbox="allow-same-origin"
          className={cn("min-h-96 w-full border-0", width === "phone" && "max-w-sm")}
        />
      </div>
    </div>
  );
}

export { EmailPreview };
