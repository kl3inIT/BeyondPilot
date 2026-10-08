# AI models: chat providers, models by task and usage

Status: proposed on 8 October 2026 ([plan](plan.md)). Tracked in Linear as BEY-92. The screens are not drawn yet; the web part waits for their approval.

## What it does

Operators connect the chat providers BeyondPilot may call, choose which model each task uses, and every call is recorded with the tokens it took. Matching ([BEY-39](https://linear.app/beyondpilot/issue/BEY-39)) is the first task; chat follows later and uses the same catalog.

It follows MemoryOS's model catalog (`D:\MemoryOS`, `docs/specs/chat-models.md`), which runs in production on the same stack (Spring Boot 4.1, Spring AI 2.0.1), and leaves out what BeyondPilot has no use for.

| Part           | What an operator sees                                                                                                  | What the application gets                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Providers      | Admin › AI › Providers, tab **Chat** before Embedding. Presets: OpenAI, Claude, 9Router, OpenRouter, OpenAI-Compatible | A stored connection: adapter, endpoint, sealed key          |
| Models         | "List models" reads the provider's own list; the operator ticks the ones to use                                        | Each model's limits, capabilities and prices                |
| Models by task | One row per task, with its model and a reasoning level; a choice is saved at once                                      | `AiModels` hands a task its chat client                     |
| Usage          | Nothing yet; a later cost module shows it                                                                              | One row per call: tokens, duration, outcome, the price then |

## Domain story

1. An operator opens Admin › AI › Providers, picks a preset and gives a key. For 9Router and OpenAI-Compatible they also type the endpoint.
2. They test the connection. BeyondPilot lists the provider's models and answers with how many it found and how long it took. No tokens are spent.
3. They list the models and tick the ones BeyondPilot may use. Each comes with its context window, output limit, capabilities and price where known.
4. Under Models by task they choose the model for Matching, and a reasoning level when the model reasons.
5. Matching asks for the model of its task, judges a candidate, and returns the client. The call is recorded.
6. The operator replaces the key. Calls already running finish on the old client; the next call uses the new one.

Failure and recovery:

- **No model chosen for a task:** the task does not run and says so. There is no silent default.
- **A provider refuses the key, cannot be reached, or does not answer as its API should:** the test and the listing name which of the three, never the provider's own text.
- **A model or provider is deleted:** the tasks that used it become unset.
- **Two operators edit the same row:** the second save is refused as stale.

## Glossary

| Term       | Meaning                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Adapter    | The code that speaks one API: `openai` (OpenAI and everything compatible with it) or `anthropic`                                            |
| Preset     | A card on the screen that fills in a name and, where it is fixed, an endpoint. Web data only; the backend does not know presets             |
| Provider   | One stored connection: purpose, adapter, endpoint, key. A chat provider and an embedding provider are separate rows, even with the same key |
| Purpose    | What a provider is connected for: `chat` or `embedding`                                                                                     |
| Model      | One model of a chat provider that an operator enabled, with its limits, capabilities and prices                                             |
| Task       | Something BeyondPilot does with a chat model, named in code (`AiTask`): `MATCHING` first                                                    |
| Task model | The model and reasoning level a task uses                                                                                                   |
| Usage      | The record of one call to a chat model                                                                                                      |

"Vendor" stays the word of the embedding tab only (OpenAI, OpenRouter), where the vendor fixes the endpoint and the models that give 1,536 dimensions.

## Commands, facts and consistency

| Command (operator)                 | Rule checked in the same transaction                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Connect, change, remove a provider | Endpoint rule; name unique per purpose; the row's version; a provider search embeds with cannot be removed |
| Enable, change, remove a model     | Unique per provider; the row's version                                                                     |
| Choose a task's model              | The model exists and its provider is enabled with a key; the row's version                                 |

| Fact                        | Who reacts                                                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| A provider or model changed | The client cache builds a new client on the next call; no event is needed, the version is compared                      |
| A chat call finished        | The usage row is written by the advisor, after the call, in its own transaction, so a failed write never fails the call |

No event crosses a module boundary in this increment.

## Data and invariant owner

A new module, `ai`, owns every table below and is the only writer.

| Table                       | Holds                                                                                                                                                                             | Notes                                                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `ai_provider` (exists, V42) | Purpose, adapter, endpoint, sealed key, enabled, version                                                                                                                          | Moves from `search`. Gains `purpose = 'chat'`, `adapter_type` and `enabled`. `vendor` stays for embedding rows only |
| `ai_model` (new)            | Provider, model name, display name, context window, output limit, tools, vision, reasoning, price per million tokens for input, output and cached input, version                  | Unique on provider and model name; removed with its provider                                                        |
| `ai_task_model` (new)       | Task, model, reasoning level, version                                                                                                                                             | One row per `AiTask`, seeded unset; the model is set to null when it is deleted                                     |
| `ai_usage` (new)            | When, task, provider and model as named then, tokens in, out, cache read and cache write, duration, outcome, error type, the prices then, what it was about (type and identifier) | Append-only. No prompt, no answer                                                                                   |

`search_settings` stays with `search`. It keeps its foreign key to `ai_provider`, which is what refuses the removal of the provider search embeds with: `ai` turns the database's refusal into `AI_PROVIDER_IN_USE` and does not need to know `search`.

## Context map

```text
identity ◄── ai ──► audit
              ▲
   search ────┤   (reads its embedding provider's connection)
   matching ──┘   (BEY-39: asks for a task's chat client)
```

- **`ai` provides:** `AiModels` (a task's chat client, leased), `AiProviders` (an embedding provider's connection, for `search`), `AiAdministration` (the operators' commands), `AiTask`.
- **`ai` requires:** `identity` for the operator check, `audit` to record changes.
- **Direction:** one way. `ai` knows no caller.
- **Calls:** synchronous. A provider call is never made inside a database transaction.

### Why a module of its own

The rule is to prefer fewer modules while evidence is incomplete ([boundary discovery](../../../conventions.md#boundary-discovery)). The evidence here:

- **Two callers.** `search` uses providers today and `matching` needs them next. V42's own comment says the tables move "to their own module" when a second feature uses a provider.
- **One writer per table.** If the tables stayed in `search`, `matching` would have to depend on `search` to reach a chat model, which is the wrong direction, or write `search`'s tables, which is forbidden.
- **Its own language and lifecycle.** Providers, models, tasks and usage change when an operator changes them or a vendor does, not when search or matching changes.

`search` keeps what is about search: which provider and model it embeds with, the index, and the embedding client.

## Decisions

| Decision                                                                                                                                            | Why                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adapters behind an **open** registry keyed by the adapter's type, as MemoryOS's `ProviderAdapterRegistry`; two beans with one type fail startup     | A new API is a new bean. This is the [interchangeable-implementations pattern](../../../conventions.md#interchangeable-implementations-strategy-behind-a-registry) with an open family                                        |
| Two adapters: `openai` and `anthropic`                                                                                                              | OpenAI, 9Router, OpenRouter and compatible endpoints differ only by endpoint, so they share one adapter, as in MemoryOS. Claude gets Spring AI's own Anthropic module for thinking and prompt caching                         |
| The adapter returns a Spring AI `ChatModel`; no Embabel                                                                                             | Matching is a fixed pipeline: retrieve, judge with structured output, store. Spring AI's `ChatClient` covers it. Embabel plans multi-step agents, which nothing here does                                                     |
| Endpoint rule as MemoryOS: `http` or `https`, private hosts allowed; no credentials, query or fragment; at most 2,048 characters                    | A self-hosted 9Router or a compatible gateway often sits on a private address. Operators are trusted to name an endpoint. This replaces BEY-72's "the vendor's exact address" for chat providers; embedding providers keep it |
| Listing models never follows a redirect; a provider's text never reaches a response or a log                                                        | A key cannot be sent on to another host, and a provider's error can repeat the request                                                                                                                                        |
| Models are read from the provider (`GET /models`) and merged with a bundled catalog; the provider's value wins, then the catalog, otherwise unknown | OpenAI names models only, Anthropic and 9Router give limits but no price, OpenRouter gives all. MemoryOS's `known-models.json` (from LiteLLM's public price list) fills the gaps. Nothing is guessed                          |
| Prices are kept per model and copied onto each usage row                                                                                            | A later price change must not rewrite what past calls cost                                                                                                                                                                    |
| Reasoning level per task (`off`, `low`, `medium`, `high`), translated by the adapter                                                                | A task knows how hard it should think; how to ask for it differs by API (`reasoning_effort`; a thinking budget for Claude)                                                                                                    |
| The client cache is MemoryOS's `ModelClients`: leased, keyed by model, replaced when a version changes, closed when its last lease closes           | Chat will stream answers that outlast a settings change. Built once now instead of rewritten then                                                                                                                             |
| One `ChatClient` advisor records every call from Spring AI's `Usage`                                                                                | Callers cannot forget to record, and input, output and cache tokens read the same for both adapters                                                                                                                           |
| A provider test lists models; a model test streams "Reply OK." with a small output limit                                                            | The first spends no tokens; the second proves the model answers                                                                                                                                                               |
| Keys keep BEY-72's sealing (AES-256-GCM, `BEYONDPILOT_AI_ENCRYPTION_KEY`), with keep, replace and remove                                            | Already in place and the same scheme as MemoryOS                                                                                                                                                                              |
| The model picker is assistant-ui's Model selector                                                                                                   | The component MemoryOS uses: search, groups by provider, logos and the reasoning row                                                                                                                                          |

## Left out

- Tokenizer profiles and request budgeting by token count.
- Groups, personas, a chat default, per-member model choice, data boundary, tenants.
- The Responses API route, native web search, and the reasoning fallbacks MemoryOS added for specific model families. They return if a model BeyondPilot uses needs them.
- Screens that show usage or cost, budgets and limits.
- Ollama, LM Studio and LiteLLM presets. OpenAI-Compatible covers them.

## References read

- MemoryOS: `core/src/main/java/io/memoryos/ai` (`ProviderAdapter`, `ProviderAdapterRegistry`, `OpenAiProviderAdapter`, `ModelClients`, `ProviderCredentials`, `ModelValidation`), `web/src/features/models`.
- Embabel (`.tmp/embabel-agent`, read, not used): `AnthropicOptionsConverter` for thinking and cache options, `PricingModel` and `LlmInvocation` for cost per call.
- Spring AI 2.0 reference: Anthropic chat, structured output, usage handling, advisors.
