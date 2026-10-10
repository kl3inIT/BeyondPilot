# AI models, document reading with OCR providers: plan

Design: [design.md](design.md). Tracked in Linear as BEY-102.

| #   | Step                                                                                                                                                                                                                                                                                                                                    | State                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | This design and plan                                                                                                                                                                                                                                                                                                                    | Done                                                                      |
| 2   | The layout of the OCR tab at 1440 and 390 with its states, for Đạt's approval                                                                                                                                                                                                                                                           | Done: described to Đạt in words on 9 October and agreed without a mock-up |
| 3   | Backend: the migration (the next free version, checked against `origin/main` right before the merge); the purpose `ocr`; `OcrAdapter`, its registry and `AiHayOcrAdapter`; JPEG pages in `PdfPages`; the reader in `DocumentPages`; usage rows; the commands and their endpoints; the connection test; `openapi.yml` and the web client | Done                                                                      |
| 4   | Web: the OCR tab with its connections and the Reader block; document reading leaves the Chat tab; messages in English and Vietnamese; end-to-end tests                                                                                                                                                                                  | Done                                                                      |
| 5   | `ARCHITECTURE.md`, `docs/specs/ai.md` and `docs/tests/ai.md` brought in line; `verification.md`                                                                                                                                                                                                                                         | Done; checked on staging on 9 October                                     |

One branch and one pull request, made of small commits in the order above.

## Verification

- `./gradlew :backend:check`. The `ai` tests speak HTTP against PostgreSQL, with AI Hay played by the JDK's `HttpServer` answering what the real service answered on 9 October; no test calls a real provider:
  - an operator connects, changes and removes an OCR provider; anyone else is refused; each change is audited;
  - the endpoint rule holds for an OCR provider as for a chat provider;
  - the test names a refused key, an unreachable service and an answer that is not the API's, and never repeats the service's text; a redirect is not followed;
  - with an OCR provider as the reader, a deck's picture-only pages are read through it and each leaves one usage row without tokens;
  - a page is sent as JPEG under the limit; a page that cannot be brought under it, or that the service refuses, is kept as read with no text and the next is still read;
  - the text the service returns is kept as it comes;
  - a refused key stops the reading and leaves the remaining pages to be read later;
  - the reader takes a model or an OCR provider, never both; a model that cannot read images and a provider that is switched off are refused; a stale save is refused;
  - deleting the OCR provider that is the reader unsets the reader;
  - with a model as the reader, reading behaves as before this change, and the reader chosen before the migration is still chosen after it.
- `pnpm --dir web check` and the end-to-end tests of Admin › AI at desktop and mobile widths, with axe.
- On staging: connect AI Hay, test it, choose it as the reader, index a deck that has picture-only pages, and read its passages and usage rows; then choose the model again.

## Needed from outside the code

| What                           | For                                | Where it is managed                                                                |
| ------------------------------ | ---------------------------------- | ---------------------------------------------------------------------------------- |
| The AI Hay key                 | Connecting it on staging           | Typed into Admin › AI by Đạt; sealed in the database, never in Git, Linear or logs |
| The price of an OCR call       | Recording what a page costs, later | AI Hay's dashboard, Billing › Pricing, behind sign-in                              |
| Approval of the OCR tab layout | Step 4                             | Đạt                                                                                |
