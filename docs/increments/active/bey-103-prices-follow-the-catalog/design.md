# AI models: a price follows the catalog unless an operator sets one

Status: accepted on 9 October 2026 and built the same day ([plan](plan.md)). Tracked in Linear as BEY-103. It changes the `ai` module and its screens only.

## What it does

Until now a model's price was copied from the bundled catalog into its row when an operator added the model, and the catalog was never read again for it. On staging on 9 October two models had no price although the catalog had listed them since it was last refreshed, and the AI Hay OCR provider had none because it was connected before prices per call existed.

One rule replaces the copy, for a model and for an OCR provider alike:

- **A row without a price follows the catalog.** The price is read when a call is made, so a corrected catalog reaches the row at the next deploy.
- **A row with a price keeps its own.** The catalog never overwrites what an operator typed.

| Part            | What an operator sees                                                                                               | What the application gets                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| A model's price | The price in effect, and under the price fields whether it follows the catalog or is their own                      | A usage row with the price in effect then                               |
| An OCR provider | The same, for the price per 1,000 pages; the field is empty for a new connection, which is charged at the catalog's | The same                                                                |
| The catalogs    | Nothing                                                                                                             | `ai/known-models.json` as before, and `ai/known-services.json`, by hand |

## Domain story

1. An operator adds `cx/gpt-6.1-sol` through a router. The catalog knows `gpt-6.1-sol`; the row keeps no price, the screen shows 2 and 10, "from the catalog".
2. A vendor lowers its price; the catalog file is refreshed and deployed. The same row now shows the new price, and the calls that follow are recorded with it. The calls recorded before keep theirs.
3. The router charges something else. The operator types that price; the row keeps it, and the screen says it is their own.
4. The operator clears the price fields. The row follows the catalog again.

Failure and recovery:

- **The catalog does not know the model, and nobody typed a price:** the price is unknown, as today; the usage row carries none.
- **An operator saves the prices the form shows without changing them:** they are the catalog's, so nothing is kept and the row goes on following. Opening and saving a model does not freeze its price.

## Data and invariant owner

`ai` stays the only writer. No table changes shape.

| Table         | Change                                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ai_model`    | The three prices now mean "the operator's own"; null means "follow the catalog". The migration empties the prices stored so far, which were all copies (see below) |
| `ai_provider` | `price_per_1k_calls` means the same for an OCR provider                                                                                                            |
| `ai_usage`    | None. A row still keeps the prices of its time                                                                                                                     |

**Existing rows.** Read on 9 October 2026: the four priced models on staging hold exactly the catalog's prices, and production has no model. A stored price cannot be told from a typed one, so the migration empties them all; from then on they follow.

## How it is built

- **`Prices`** answers the price in effect for a model and for an OCR provider, and what to keep on a row for what an operator saved: nothing when it equals the catalog's.
- **`KnownServices`** reads `ai/known-services.json`, what services that bill by the call charge, by the adapter's type. The file is kept by hand: `known-models.json` is regenerated from LiteLLM's list by `backend/scripts/sync-known-models.mjs`, which would drop a hand-written entry, and it holds models billed by the token. An entry keeps the price in dollars, the price as the service lists it, the rate used and the day it was read.
- **`AiModels`** and **`DocumentPages`** take the price for the usage row from `Prices`.
- **The settings** return the price in effect and `priceFromCatalog`, for a model and for an OCR provider.
- **Web:** the model dialog and the OCR provider dialog say under the price whether it follows the catalog or is the operator's own. The AI Hay preset no longer carries a price.

## Decisions

| Decision                                                                  | Why                                                                                                                                      |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| The catalog is read when a call is made, not written into rows at startup | A job that writes needs a mark on each row for where its price came from, and runs at every start. Reading needs neither                 |
| An empty price is the mark for "follow the catalog"                       | No new column, and one gesture for the operator: clear the field                                                                         |
| A price saved equal to the catalog's is not kept                          | The form shows the price in effect, so saving any other field would otherwise freeze the price without the operator meaning to           |
| Filling in only the models that have no price was not chosen              | It was proposed in another session the same day. It leaves a model that has an old price on that old price when the catalog is corrected |
| OCR prices in a file of their own                                         | The model catalog is generated, and a service is billed by the call                                                                      |
| No currency conversion in the application                                 | A rate moves; the file keeps the listed price and the rate used, so the sum can be redone when it is edited                              |

## Left out

- A catalog of what a gateway charges. A gateway that charges something other than the vendor's list price is what setting a price is for.
- Showing on the screen when the catalog was last refreshed.
