# A solution's logo, cover and images, and what its owners do from the list: plan

Design: [design.md](design.md). Tracked in Linear as BEY-34.

| #   | Step                                                                                                                                                                   | State       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1   | The frames in Figma, in one section in the order of the product: the public pages, the provider's workspace with its row menus, the operators' review                  | Done        |
| 2   | `V37` and `V38`; the purposes `solution_logo` and `solution_image`; the images on `Solution`, its request and its responses; `missing` on the list of an organization  | Done        |
| 3   | Naming, moving and dropping images in `SolutionService`; `DroppedFiles` for the deck and the images; a save that takes nothing away from a reviewed solution           | Done        |
| 4   | `SolutionTest`, the tests of the modules that send a solution for review, and the matrix in `docs/tests/solution.md`; `openapi.yml` and the generated web client       | Done        |
| 5   | Web: the image controls of the Evidence step, the review step, the card and the page of the directory, the row menu with its confirmations, the operators' record      | Done        |
| 5b  | What GenAI Fund says of a solution (`V39`, the operators' form, the card, the facts and the proof of the page), the channels, the review as a pill, the logo in search | Done        |
| 6   | Unit tests of the editor's state; end-to-end tests of the images, the row menus and the public page                                                                    | Written     |
| 7   | Both gates, and the end-to-end suite, on the whole change                                                                                                              | Not run yet |

## Verification

- `SolutionTest`, `IntroductionTest`, `ProposalTest`, `SearchDirectoriesTest`, `LocalStorageTest`, `ModulithArchitectureTest`, `MigrationVersionsTest` and `OpenApiContractTest` pass on the change.
- `pnpm --dir web check` passes, with `solution-editor-state.test.ts`.
- The screens were walked against the real backend at 1440 and 390 pixels, with sample solutions in every state: the directory and a solution's page with four, two and no images under the cover, the gallery, the Evidence step with an upload saved by itself, the review with a logo and a cover missing, the row menus, showing and hiding a solution, copying its link, and the operators' record.
- The end-to-end specs `solutions`, `workspace-solutions` and `admin-solutions` were updated for the new screens and have not been run on the change yet; neither has the whole of `./gradlew :backend:check`.

## Beside the plan

`backend/compose.yaml` names the database service for Spring Boot (`org.springframework.boot.service-connection: postgres`). Since the image became `pgvector/pgvector`, `./gradlew :backend:bootRun` stopped with "Failed to configure a DataSource", because Spring Boot finds the database by the image's name.
