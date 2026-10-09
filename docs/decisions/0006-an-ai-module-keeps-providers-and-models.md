# ADR 0006: An `ai` module keeps the providers, and later the models, that other modules call

- Status: Accepted, implementation started 2026-10-08
- Date: 2026-10-08
- Decision owner: BeyondPilot team

## Context

`search` kept the AI providers operators connect, their sealed keys and the client that embeds text, because it was the only module that called a provider. V42's own comment said the tables would move "to their own module" when a second feature used one.

Matching ([BEY-39](https://linear.app/beyondpilot/issue/BEY-39)) is that second feature: it needs a chat model to judge candidates, and chat itself follows. A module may not write another module's tables, so with the providers left in `search`, `matching` would have to depend on `search` only to reach a key.

The domain story, glossary, data owners and context map are in the [BEY-92 design](../increments/active/bey-92-ai-models/design.md), as [boundary discovery](../conventions.md#boundary-discovery) asks.

## Decision

- **A module `ai` owns `ai_provider` and the sealing of keys.** It depends on `identity` and `audit` and knows no caller.
- **`search` depends on `ai`.** It reads its embedding provider's connection through `AiProviders` and keeps what is about search: which provider and model it embeds with, the embedding client and the index.
- **A provider belongs to one purpose** (`embedding` now, `chat` next). The module that uses a purpose decides what an address and a model may be; `ai` keeps the provider, seals its key and records each change.
- **A saved key is kept only while the address it was given for is unchanged**, for every purpose, as BEY-72 decided for embeddings.
- **What uses a provider points at it in the database.** `search_settings` keeps its foreign key to `ai_provider`, so the database refuses to remove a provider in use and `ai` needs no knowledge of `search`.
- **The Embedding tab's HTTP contract does not change.** `search` words a refusal of `ai` in the `SEARCH_PROVIDER_*` codes it has always answered with.
- **The encryption key is read from `beyondpilot.ai.encryption-key`.** The environment variable stays `BEYONDPILOT_AI_ENCRYPTION_KEY`.

## Alternatives considered

- **Leave the providers in `search` and let `matching` depend on it.** The dependency would point at a module for something that is not search, and every later AI feature would add another.
- **Each module keeps its own providers.** The same key would be stored twice and an operator would connect the same account in two places.
- **Move the embedding client to `ai` as well.** What it embeds, when and with how many dimensions is search's own; only the connection is shared.

## Consequences

- A new dependency edge, `search` → `ai`, recorded in `ModulithArchitectureTest` and `ARCHITECTURE.md`.
- Chat providers, models, models by task and the usage record are added to `ai` by BEY-92 without touching `search`.
- A module that needs a model depends on `ai`, never on another module that happens to use one.
