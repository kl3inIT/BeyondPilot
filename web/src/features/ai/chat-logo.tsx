import { cn } from "cn";
import { PlugZapIcon } from "lucide-react";
import Image from "next/image";

import type { ChatPreset } from "./chat-presets";

/**
 * The marks under `public/provider-logos`, the ones MemoryOS shows (LobeHub icons, MIT, beside
 * 9Router's own); a monochrome one follows the theme.
 */
const marks: Partial<Record<ChatPreset["id"], { file: string; monochrome: boolean }>> = {
  openai: { file: "openai.svg", monochrome: true },
  claude: { file: "anthropic.svg", monochrome: false },
  ninerouter: { file: "nine-router.svg", monochrome: false },
  openrouter: { file: "openrouter.svg", monochrome: true },
};

/**
 * A chat provider's mark in a framed square, beside its name. An endpoint without a mark of its
 * own gets a plain sign of what it is.
 */
function ChatLogo({ preset, className }: { preset: ChatPreset["id"]; className?: string }) {
  const mark = marks[preset];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-foreground",
        className,
      )}
    >
      {mark ? (
        <Image
          src={`/provider-logos/${mark.file}`}
          alt=""
          width={18}
          height={18}
          unoptimized
          className={cn("size-4.5 object-contain", mark.monochrome && "dark:invert")}
        />
      ) : (
        <PlugZapIcon className="size-4.5" />
      )}
    </span>
  );
}

export { ChatLogo };
