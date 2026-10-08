import type { ChatProvider } from "@/lib/api/generated";

/**
 * The providers the Chat tab offers to connect. A preset is web data only: the backend knows two
 * adapters, and everything that speaks the OpenAI API differs by its address alone.
 */
const chatPresets = [
  {
    id: "openai",
    name: "OpenAI",
    adapterType: "openai",
    baseUrl: "https://api.openai.com/v1",
    group: "vendors",
  },
  {
    id: "claude",
    name: "Claude",
    adapterType: "anthropic",
    baseUrl: "https://api.anthropic.com",
    group: "vendors",
  },
  { id: "ninerouter", name: "9Router", adapterType: "openai", baseUrl: "", group: "gateways" },
  {
    id: "openrouter",
    name: "OpenRouter",
    adapterType: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    group: "gateways",
  },
  {
    id: "compatible",
    name: "OpenAI-Compatible",
    adapterType: "openai",
    baseUrl: "",
    group: "custom",
  },
] as const;

type ChatPreset = (typeof chatPresets)[number];

const presetGroups = ["vendors", "gateways", "custom"] as const;

/** The preset a saved provider looks like, for its mark: by its adapter, then its address, then its name. */
function presetOf(
  provider: Pick<ChatProvider, "adapterType" | "baseUrl" | "name">,
): ChatPreset["id"] {
  if (provider.adapterType === "anthropic") {
    return "claude";
  }
  if (provider.baseUrl.includes("://api.openai.com")) {
    return "openai";
  }
  if (provider.baseUrl.includes("://openrouter.ai")) {
    return "openrouter";
  }
  return /9\s?router/i.test(provider.name) ? "ninerouter" : "compatible";
}

/** A count of tokens as the tables show it: 200K, 1M. */
function tokens(count: number): string {
  if (count >= 1_000_000) {
    return `${Number((count / 1_000_000).toFixed(1))}M`;
  }
  return count >= 1000 ? `${Math.round(count / 1000)}K` : String(count);
}

/** A price in US dollars per million tokens; a dash when nobody published one. */
function price(amount: number | null | undefined): string {
  return amount === null || amount === undefined ? "—" : `$${Number(amount.toFixed(4))}`;
}

export { chatPresets, presetGroups, presetOf, price, tokens, type ChatPreset };
