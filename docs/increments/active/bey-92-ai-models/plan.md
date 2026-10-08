# AI models: plan

Design: [design.md](design.md). Tracked in Linear as BEY-92.

| #   | Step                                                                                                                                                                                                                                                                                                                                    | State                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 1   | This design and plan                                                                                                                                                                                                                                                                                                                    | Done                           |
| 2   | Figma: Admin › AI › Providers with the Chat tab first (Models by task, Available connections, Add provider), the provider dialog with List models, the test results and the unset task, at 1440 and 390                                                                                                                                 | Waits for the Figwright plugin |
| 3   | Backend: the `ai` module takes providers and their keys from `search`, unchanged in behavior. `search` reads its embedding provider through `AiProviders`. The provider endpoints move to `/api/ai/admin`; `openapi.yml` and the web client are refreshed. `ModulithArchitectureTest`, `ARCHITECTURE.md` and the ADR for the new module | Not started                    |
| 4   | Backend: chat providers. `ChatAdapter`, the open registry, the `openai` and `anthropic` adapters, the endpoint rule, the connection test                                                                                                                                                                                                | Not started                    |
| 5   | Backend: models. Listing from the provider, the bundled catalog and the merge, `ai_model`, the model test                                                                                                                                                                                                                               | Not started                    |
| 6   | Backend: models by task. `ai_task_model`, the reasoning level, the leased client cache, `AiModels`                                                                                                                                                                                                                                      | Not started                    |
| 7   | Backend: usage. The advisor and `ai_usage`                                                                                                                                                                                                                                                                                              | Not started                    |
| 8   | Web: the tabs, the Chat tab and its dialogs, the assistant-ui Model selector                                                                                                                                                                                                                                                            | After step 2 is approved       |
| 9   | Documents made true: `docs/specs/ai.md`, `docs/tests/ai.md`, the search spec and matrix, the runbook's note on the encryption key                                                                                                                                                                                                       | With each step                 |

Steps 3 to 7 are one pull request each, in order; each leaves `main` working. Step 3 is a clean cutover: nothing about providers stays in `search`.

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
