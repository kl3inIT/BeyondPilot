import { AppWindowIcon } from "lucide-react";
import { siClaude, siCursor, siZedindustries } from "simple-icons";

import { openAiMark } from "@/components/composites/openai-mark";

type Mark = { viewBox: string; path: string };

const openAi: Mark = openAiMark;
const claude: Mark = { viewBox: "0 0 24 24", path: siClaude.path };
const cursor: Mark = { viewBox: "0 0 24 24", path: siCursor.path };
const zed: Mark = { viewBox: "0 0 24 24", path: siZedindustries.path };

/** The marks of the AI apps people connect, by the host their client ID belongs to. */
const marksByHost: Record<string, Mark> = {
  "chatgpt.com": openAi,
  "claude.ai": claude,
  "claude.com": claude,
  "zed.dev": zed,
};

/** Clients BeyondPilot registered itself, by client ID. */
const marksByClient: Record<string, Mark> = { cursor };

/**
 * An AI app's mark in a framed square, in the text colour so it follows the theme: OpenAI's for ChatGPT and Codex, Claude's, Zed's, Cursor's, or a
 * plain window for any other. Decorative: the app's name always stands beside it.
 */
function AppMark({ host, clientId }: { host?: string | null; clientId: string }) {
  const mark = (host ? marksByHost[host] : undefined) ?? marksByClient[clientId];
  return (
    <span
      aria-hidden="true"
      className="flex size-12 shrink-0 items-center justify-center rounded-md border bg-background"
    >
      {mark ? (
        <svg viewBox={mark.viewBox} fill="currentColor" className="size-6.5 text-foreground">
          <path d={mark.path} />
        </svg>
      ) : (
        <AppWindowIcon className="size-6 text-muted-foreground" />
      )}
    </span>
  );
}

export { AppMark };
