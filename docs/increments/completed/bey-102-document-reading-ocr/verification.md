# AI models, document reading with OCR providers: verification

Design: [design.md](design.md). Plan: [plan.md](plan.md). Tracked in Linear as BEY-102.

## Commands run on 9 October 2026

| Command                                                                                        | Outcome                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `./gradlew :backend:check`                                                                     | Passed: 45 suites, 394 tests, no failure. It includes `OcrAdministrationTest` (8 tests), `DocumentPagesTest`, `ModulithArchitectureTest` and `OpenApiContractTest` |
| `BEYONDPILOT_OPENAPI_WRITE=true ./gradlew :backend:test --tests '*OpenApiContractTest'`        | `openapi.yml` rewritten with the six OCR operations                                                                                                                |
| `pnpm --dir web generate:api`                                                                  | The web client regenerated from it                                                                                                                                 |
| `pnpm --dir web check:api`, `lint`, `format:check`, `typecheck`, `test:unit`, `check:messages` | Each passed; the message catalogs match at 4,490 keys                                                                                                              |
| `pnpm --dir web knip`                                                                          | Did not run on the development machine: Node could not allocate its buffer with 1.1 GB of memory free. Left to CI                                                  |

## Checked against the real service

- The picture the connection test sends, `backend/src/main/resources/ai/ocr-test.jpg`, was sent to AI Hay's OCR once: it answered 200 in 1.2 seconds with `# BeyondPilot reads this line 2468`, which holds the text the test looks for.
- The answers the stub service gives in `OcrAdministrationTest` are the ones AI Hay gave while it was probed: the shape of a reading, of a refused key (401), of a refused picture (400) and of an upstream failure (503).

## The price of an OCR call, added after the first merge

The OCR provider keeps what 1,000 calls cost in US dollars and each usage row copies it (`V64`; it was `V63` until matching took that number on main the same day). Commands run on 9 October 2026, on a machine short of memory, so the whole gate was left to CI:

| Command                                                                                                                        | Outcome                                               |
| ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `./gradlew :backend:test` for the `ai` tests, `SearchAdministrationTest`, `OpenApiContractTest` and `ModulithArchitectureTest` | Passed: 7 suites, 42 tests, no failure                |
| `pnpm --dir web` `check:api`, `typecheck`, `lint`, `check:messages`, `format:check`                                            | Each passed; the message catalogs match at 4,493 keys |

## On staging, 9 October 2026

Pull request #150 was merged with every check green, the end-to-end tests of Admin › AI among them.

| Check                                                                                                       | Result                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| AI Hay connected, tested and chosen as the reader in Admin › AI › Providers › OCR                           | Done by Đạt; the test read the picture                                                                                     |
| Deck pages that are only a picture, read by the service                                                     | 957 calls in `ai_usage` under `aihay`, 9 of them failed; no deck page is left unread                                       |
| A deck laid out as a poster (`mapping-intelligence-technology-pte-ltd`), whose pages were too large to send | Read after its pages were capped at 2,200 pixels on the long side (pull request #156) and its 10 pages marked unread again |

The model was not chosen again as the reader afterwards: AI Hay stays the reader on staging.
