# AI models, a fallback model per task: plan

Design: [design.md](design.md). Tracked in Linear as BEY-101.

| #   | Step                                                                                                                                                                                                                                                                                                                                                            | State   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | This design and plan                                                                                                                                                                                                                                                                                                                                            | Done    |
| 2   | Backend: the migration (the next free version, checked against `origin/main` right before the merge); the failure kinds and their table; the method on `ChatAdapter` in both adapters; the model that falls back and the rests; recording per attempt in place of the advisor; the rules of the command; `fallbackInUseUntil`; `openapi.yml` and the web client | Waiting |
| 3   | Web: the fallback selector in the task block, the line about one provider, the note while a task is answered by its fallback; messages in English and Vietnamese; end-to-end tests                                                                                                                                                                              | Waiting |
| 4   | `docs/specs/ai.md` and `docs/tests/ai.md` brought in line; `verification.md`                                                                                                                                                                                                                                                                                    | Waiting |

One branch and one pull request, made of small commits in the order above.

## Verification

- `./gradlew :backend:check`. The `ai` tests speak HTTP against PostgreSQL, with providers played by the JDK's `HttpServer`; no test calls a real provider:
  - the table gives each status and exception type its kind, for both adapters;
  - a call the main model answers with 503, 429, 401, 402 or 404 is answered by the fallback, and leaves two usage rows, the second marked as the fallback;
  - a call the main model answers with 400 is not sent to the fallback and fails;
  - after a failure the next call goes straight to the fallback; after the rest it tries the main model again, and a success ends the rest;
  - a `retry-after` is honoured and capped;
  - both models failing raises the main model's failure;
  - a task whose main model cannot be used runs on its fallback; a task with neither does not run;
  - a fallback equal to the main model, one without a main model, one on a disabled provider and one that cannot read images for document reading are each refused; a stale save is refused;
  - deleting the fallback's model unsets the fallback only;
  - a task without a fallback behaves as before this change.
- `pnpm --dir web check` and the end-to-end tests of Admin › AI at desktop and mobile widths, with axe.
- On staging: give Matching a fallback on another provider, switch the main model's provider off, run a match, and read the usage rows and the note on the task.

## Needed from outside the code

| What                                    | For                  | Where it is managed                                                          |
| --------------------------------------- | -------------------- | ---------------------------------------------------------------------------- |
| Two chat providers connected on staging | The check on staging | Admin › AI, by Đạt; a second one is connected there if only one exists today |
