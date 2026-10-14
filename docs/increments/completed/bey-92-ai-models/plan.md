# AI models: plan

Design: [design.md](design.md). Tracked in Linear as BEY-92.

| #   | Step                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | State                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 1   | This design and plan                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Done                        |
| 2   | Figma: Admin › AI › Providers with the Chat tab first (Models by task, Available connections, Add provider), the provider dialog with List models and Test connection, the model selector, and the states, at 1440 and 390. Section "Admin — AI: chat providers and models by task (draft for review, BEY-92)"                                                                                                                                                                                                                                                                                    | Done; approved on 8 October |
| 3   | Backend, one pull request: the `ai` module takes providers and their keys from `search` (a clean cutover; `search` reads its embedding provider through `AiProviders`); chat adapters behind the open registry (`openai`, `anthropic`) with the endpoint rule and the connection test; models listed from the provider and merged with the bundled catalog; models by task with the reasoning level and the leased client cache; the usage advisor. `openapi.yml` and the web client refreshed; `ModulithArchitectureTest`, `ARCHITECTURE.md`, the ADR, `docs/specs/ai.md` and `docs/tests/ai.md` | Done                        |
| 4   | Web, one pull request: the tabs, the Chat tab and its dialogs, the assistant-ui Model selector, end-to-end tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Done                        |

The backend is one pull request and the web another, each made of small commits in the order above, so a commit can still be read alone.

## Verification

- `./gradlew :backend:check`. The `ai` tests speak HTTP against PostgreSQL, with a provider played by the JDK's `HttpServer`, as MemoryOS tests its adapter; no test calls a real provider:
  - an operator connects, changes and removes a chat provider; anyone else is refused; each change is audited;
  - an endpoint with credentials, a query or a fragment is refused; `http` and a private host are accepted;
  - a test names a refused key, an unreachable provider and an answer that is not the API's, and never repeats the provider's text; a redirect is not followed;
  - listing reads each provider's own fields, and the catalog fills what a provider leaves out; an unknown price stays unknown;
  - a task without a model does not run; removing its model unsets it; a stale save is refused;
  - a changed key gives the next call a new client while a call in flight finishes on the old one;
  - every call leaves one usage row with its tokens and the price then, and a failed call leaves one with its error type;
  - the provider `search` embeds with cannot be removed, and search behaves as before the move.
- `pnpm --dir web check` and the end-to-end tests of Admin › AI at desktop and mobile widths, with axe.
- On staging: connect OpenAI, Claude and the 9Router endpoint, list their models, choose one for Matching and read the usage rows of a test call.

## Needed from outside the code

| What                                            | For                            | Where it is managed                                                                |
| ----------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------- |
| The Claude key and the 9Router endpoint and key | Connecting them on staging     | Typed into Admin › AI by Đạt; sealed in the database, never in Git, Linear or logs |
| `BEYONDPILOT_AI_ENCRYPTION_KEY` on production   | Storing any provider key there | The production secret files; already set on staging                                |
