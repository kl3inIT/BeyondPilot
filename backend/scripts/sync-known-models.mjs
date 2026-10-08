#!/usr/bin/env node
// Regenerates backend/src/main/resources/ai/known-models.json from LiteLLM's model metadata file at one commit.
// The transformation is MemoryOS's scripts/sync-chat-known-models.mjs, so the file keeps the shape KnownModels reads.
//
//   node backend/scripts/sync-known-models.mjs <commit-sha> [downloaded-file]
//
// Without a downloaded file the script fetches the commit's file itself. Review the diff before committing it.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_REPO = "BerriAI/litellm";
const SOURCE_FILE = "model_prices_and_context_window.json";
const SOURCE_COMMIT = process.argv[2];
const DOWNLOADED = process.argv[3];
if (!/^[0-9a-f]{40}$/.test(SOURCE_COMMIT ?? "")) {
  throw new Error("Usage: node backend/scripts/sync-known-models.mjs <40-character commit sha> [downloaded-file]");
}
// Vendors whose /models endpoint names models without all their limits or prices. LiteLLM keys the non-OpenAI ones
// as "<provider>/<model>"; the prefix is dropped because the endpoints report the bare name.
const PROVIDERS = new Set(["openai", "anthropic", "gemini", "xai", "deepseek", "mistral"]);
const OUTPUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "main",
  "resources",
  "ai",
  "known-models.json",
);

let source;
if (DOWNLOADED) {
  source = JSON.parse(readFileSync(DOWNLOADED, "utf8"));
} else {
  const url = `https://raw.githubusercontent.com/${SOURCE_REPO}/${SOURCE_COMMIT}/${SOURCE_FILE}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} responded ${response.status}`);
  source = await response.json();
}
const retrieved = new Date().toISOString().slice(0, 10);

const models = [];
for (const [modelName, entry] of Object.entries(source)) {
  if (!entry || typeof entry !== "object" || entry.mode !== "chat") continue;
  if (!PROVIDERS.has(entry.litellm_provider)) continue;
  const prefix = `${entry.litellm_provider}/`;
  const bareName = modelName.startsWith(prefix) ? modelName.slice(prefix.length) : modelName;
  if (bareName.includes("/")) continue;
  if (entry.deprecation_date && entry.deprecation_date < retrieved) continue;
  const contextWindow = entry.max_input_tokens;
  const maxOutputTokens = entry.max_output_tokens;
  const input = entry.input_cost_per_token;
  const output = entry.output_cost_per_token;
  // An incomplete row is dropped rather than completed with a guess.
  if (!Number.isInteger(contextWindow) || !Number.isInteger(maxOutputTokens)) continue;
  if (contextWindow < 256 || contextWindow > 10_000_000) continue;
  if (maxOutputTokens < 1 || maxOutputTokens >= contextWindow) continue;
  if (typeof input !== "number" || typeof output !== "number") continue;
  if (models.some((model) => model.modelName === bareName)) continue;
  models.push({
    modelName: bareName,
    contextWindow,
    maxOutputTokens,
    toolCalling: entry.supports_function_calling === true,
    vision: entry.supports_vision === true,
    reasoning: entry.supports_reasoning === true,
    // Base rates only. LiteLLM's "*_above_<n>k_tokens" rates are left out: the catalog, ai_model and ai_usage hold
    // one rate each, so a call above a vendor's threshold is recorded with the lower rate.
    inputPerMillion: Number((input * 1e6).toFixed(6)),
    outputPerMillion: Number((output * 1e6).toFixed(6)),
    // Prompt-cache reads are billed at their own rate; absent means the input rate applies.
    ...(typeof entry.cache_read_input_token_cost === "number"
      ? { cachedInputPerMillion: Number((entry.cache_read_input_token_cost * 1e6).toFixed(6)) }
      : {}),
  });
}
models.sort((left, right) => left.modelName.localeCompare(right.modelName, "en"));
if (models.length < 50) throw new Error(`Only ${models.length} models survived filtering`);

const document = {
  source: {
    repository: `https://github.com/${SOURCE_REPO}`,
    file: SOURCE_FILE,
    commit: SOURCE_COMMIT,
    retrieved,
    licence: "MIT (Copyright (c) 2023 Berri AI)",
    providers: [...PROVIDERS].sort(),
  },
  models,
};
writeFileSync(OUTPUT, `${JSON.stringify(document, null, 2)}\n`, "utf8");
process.stdout.write(`${OUTPUT}: ${models.length} models\n`);
