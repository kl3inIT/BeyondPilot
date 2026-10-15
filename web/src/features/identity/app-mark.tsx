import { AppWindowIcon } from "lucide-react";
import { siClaude, siCursor, siZedindustries } from "simple-icons";

import { openAiMark } from "@/components/composites/openai-mark";

/**
 * A mark and, for a brand that has one, its colour from Simple Icons, which reads on both themes.
 * OpenAI's and Cursor's marks are black or white by their own guidelines, so they follow the text.
 */
type Mark = { viewBox: string; path: string; colour?: string };

const openAi: Mark = openAiMark;
const claude: Mark = { viewBox: "0 0 24 24", path: siClaude.path, colour: `#${siClaude.hex}` };
const cursor: Mark = { viewBox: "0 0 24 24", path: siCursor.path };
const zed: Mark = {
  viewBox: "0 0 24 24",
  path: siZedindustries.path,
  colour: `#${siZedindustries.hex}`,
};

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
 * An AI app's mark in a framed square: OpenAI's for ChatGPT and Codex and Cursor's in the text colour,
 * Claude's and Zed's in their brand colour, or a plain window for any other. Decorative: the app's
 * name always stands beside it.
 */
function AppMark({
  host,
  clientId,
  inline = false,
}: {
  host?: string | null;
  clientId: string;
  /** The bare mark at the size of a label's text, for a tab or a line; otherwise a framed tile. */
  inline?: boolean;
}) {
  const mark = (host ? marksByHost[host] : undefined) ?? marksByClient[clientId];
  const drawn = mark ? (
    <svg
      viewBox={mark.viewBox}
      fill={mark.colour ?? "currentColor"}
      className={inline ? "size-4 text-foreground" : "size-6.5 text-foreground"}
    >
      <path d={mark.path} />
    </svg>
  ) : (
    <AppWindowIcon
      className={inline ? "size-4 text-muted-foreground" : "size-6 text-muted-foreground"}
    />
  );
  if (inline) {
    return <span aria-hidden="true">{drawn}</span>;
  }
  return (
    <span
      aria-hidden="true"
      className="flex size-12 shrink-0 items-center justify-center rounded-md border bg-background"
    >
      {drawn}
    </span>
  );
}

export { AppMark };
