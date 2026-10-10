# AI models, a price follows the catalog: plan

Design: [design.md](design.md). Tracked in Linear as BEY-103.

| #   | Step                                                                                                                                                                                    | State                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 1   | This design and plan                                                                                                                                                                    | Done                                 |
| 2   | Backend: `Prices`, `KnownServices` and `ai/known-services.json`; the price in effect on usage rows; `priceFromCatalog` in the settings; the migration; `openapi.yml` and the web client | Done                                 |
| 3   | Web: the lines under the price fields of the model and OCR provider dialogs; the preset without a price; messages in English and Vietnamese                                             | Done                                 |
| 4   | `docs/specs/ai.md` and `docs/tests/ai.md` brought in line                                                                                                                               | Done                                 |
| 5   | On staging: the two models without a price and the AI Hay provider show the catalog's; a deck page read by OCR leaves a usage row at 1.50 per 1,000 calls                               | Done, but for the OCR row: see below |

One branch and one pull request.

## Verification

Commands run on 9 October 2026, on a machine short of memory, so the whole gates were left to CI:

- `./gradlew :backend:test` for `AiAdministrationTest` (15 tests) and `OcrAdministrationTest` (8 tests): no failure. They cover:
  - a model added without a price, through a router that prefixes its name, shows the catalog's prices, keeps none in its row, and its call is recorded at the catalog's price;
  - a price an operator sets is theirs and is no longer the catalog's;
  - saving the catalog's own prices returns the model to the catalog;
  - an OCR provider saved at the catalog's price keeps none and follows; one saved at another price keeps its own.
- `OpenApiContractTest` with `BEYONDPILOT_OPENAPI_WRITE=true` rewrote `openapi.yml`; `pnpm --dir web generate:api` regenerated the client.
- `pnpm --dir web` `check:api`, `typecheck`, `lint`, `check:messages`, `format:check`.

## On staging, 10 October 2026

Pull request #158 was merged and staging has run its migration (`V68`).

- No model keeps a price of its own: `input_price` and `output_price` are empty on all six rows of `ai_model`, and the AI Hay provider has no `price_per_1k_calls`, so each follows the catalog.
- The 62 calls to `cx/gpt-6.1-sol` that answered since the deploy were recorded at 2 and 10 US dollars per million tokens, the catalog's prices. Before, that model had none.
- Not seen: a usage row of an OCR call at 1.50 per 1,000 calls. No page has been read by OCR since the deploy. The same rule is covered by `OcrAdministrationTest`, and the first page read will show it in Admin › AI › Usage.
