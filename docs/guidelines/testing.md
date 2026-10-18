# Testing and verification

## Choose the boundary

The test policy and the boundary-selection table are in [engineering conventions](../conventions.md#testing). Apply them before choosing an annotation or writing another test. Module matrices under `docs/tests/` name the existing checks for each contract.

## Local execution

- Docker must be running. Integration tests start PostgreSQL through Testcontainers: `TestcontainersConfiguration` (`backend/src/test/java/ai/genaifund/beyondpilot/`) declares the container as a `@ServiceConnection` bean.
- Run commands from the repository root; on Windows use `gradlew.bat`.

  ```text
  ./gradlew :backend:test --tests '*SomeTest'
  ./gradlew :backend:check
  ```

- `TestBeyondPilotApplication` starts the application against the same Testcontainers PostgreSQL through `./gradlew :backend:bootTestRun`, without the Docker Compose file.
- Unit tests need no Docker; only tests that start a Spring context with the database do.

## Web tests

The three boundaries of a web test, and when to pick which, are in [quality gates](../conventions.md#quality-gates). Run them from `web/`:

```text
pnpm test:unit                                  # every *.test.ts and *.test.tsx
pnpm exec vitest run src/components/form        # the tests under a path
pnpm exec vitest run --project node             # only the functions, or --project dom for the components
pnpm test:e2e                                   # Playwright, against the production build
```

`web/vitest.config.mts` holds two projects that one `vitest run` runs together. The name of a file chooses its project: `*.test.ts` runs in Node and pays for no DOM, `*.test.tsx` runs in jsdom after `src/test/setup.ts`.

### Component tests

- **Draw with `render` of `@/test/render`**, which Oxlint requires in place of Testing Library's. It draws the component as the application would: inside next-intl with the English catalog (`messages/en.json`), the app's formats and Vietnam time, and inside nuqs's testing adapter. It takes Testing Library's options and `searchParams`, the query of the page (`"?page=3"`), and answers what Testing Library's `render` does, with `user` (a `userEvent` session: `await user.click(…)`) and `onUrlUpdate`, a spy called with each query nuqs writes (`onUrlUpdate.mock.lastCall?.[0].queryString`).
- **The router is a stand-in.** `next/navigation`'s `useRouter`, `usePathname`, `useSearchParams` and `useParams` are replaced for every component test by those of `src/test/navigation.ts`: the page is `/` in English and the router's methods are spies, emptied after each test. A test that expects a navigation or a refresh imports `router` from `@/test/navigation` and asserts on it.
- **Find elements as a person does**: by role and accessible name, by label, by text (`screen.getByRole("button", { name: "Save" })`). The text is the English catalog's, so a test reads what the screen says. Assert with the DOM matchers of `@testing-library/jest-dom` (`toHaveFocus`, `toHaveAccessibleDescription`, `toBeInvalid`). `eslint-plugin-testing-library` and `eslint-plugin-jest-dom`, loaded by Oxlint as JS plugins, check both.
- **Wait for what arrives later.** After an action whose effect is not in the same tick, assert through `await waitFor(() => expect(…))` or a `findBy…` query, never synchronously: a URL nuqs writes, a form validated or submitted, a dialog opening or closing with its animation, a focus moved a frame later (`focusFirstInvalidSoon`). A synchronous assertion passes on a fast machine and fails in CI.
- **jsdom has no layout.** It applies no stylesheet, so what a breakpoint hides is in the document, and it reports every size as 0. The setup file stands in for what jsdom lacks so that a component which asks does not throw: `matchMedia` matches nothing, `ResizeObserver` never reports, `scrollIntoView` does nothing. A test whose behavior depends on one of them stubs its own with `vi.spyOn` or `vi.stubGlobal`, as `table-scroll.test.tsx` does for sizes. What depends on real layout, scrolling or a media query is a Playwright test.
- **jsdom, not happy-dom.** Base UI's dialogs, checkboxes and collapsibles, under the registry primitives, ran in it with no extra setup; and jsdom follows the specification on what may take the focus (not a disabled control, a hidden input or a plain group), which the focus tests rely on.
- **No MSW yet.** No component under test calls the API: a write is the caller's `onSubmit`, which a test passes in. MSW arrives with the first component test that needs an answer from the API; do not stub `fetch` by hand in a component test before that.
- The React Compiler does not run in these tests; a component must be correct without it.

## Required gates

1. Run focused tests while changing a contract.
2. Run `./gradlew :backend:check` before opening a pull request. It requires a working Docker daemon.
3. Exercise the changed runtime surface: start the application ([development runtime](../runbooks/development-runtime.md)) and call the changed endpoint, not only compile and test.
4. An API change regenerates `openapi.yml` in the same change ([published API contracts](../conventions.md#published-api-contracts)).

## Continuous integration

`.github/workflows/ci.yml` runs on every branch push, so a branch is verified before `main` is fast-forwarded onto it. A push that changes only documents (`docs/`, `.claude/`, Markdown at the root, and any `README.md`, `AGENTS.md` or `CLAUDE.md`) runs no CI and so publishes no release; the email templates in `backend/src/main/resources` are Markdown the api ships and still run it. A newer push to the same branch cancels the older run.

| Job                   | Runs                                                                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workflows and secrets | actionlint on the workflows, shellcheck on the deployment scripts, and gitleaks over the full history                                                    |
| Backend               | `./gradlew :backend:check` on Temurin 25, with Testcontainers on the runner's Docker                                                                     |
| Web                   | `pnpm --dir web check`, which runs the function and component tests among its gates, then `pnpm --dir web audit --audit-level=high`                      |
| Web end-to-end        | `pnpm --dir web test:e2e` on Chromium, desktop and Pixel 7; CI splits it across four shards with `--shard=N/4`                                           |
| Images                | Builds both images, starts the local composition from them, checks the proxy's routes and the revision labels; on a main push, pushes the images to GHCR |
| Publish release       | On a main push, after every other job: the `release-<sha>` artifact that [Deploy staging](../runbooks/ci-cd.md) promotes                                 |

- Actions are pinned to commit SHAs; Dependabot (`.github/dependabot.yml`) proposes Gradle, pnpm, Actions and base-image upgrades weekly, grouped by risk class and at least three days after publication.
- A high advisory fails the web job. Fix it by upgrading; when the vulnerable version is pinned by a dependency, override it in `web/pnpm-workspace.yaml` with a comment naming the advisory and when to drop it.
- A failed job uploads its test or Playwright report as a run artifact for seven days.
- **Press after hydration.** A Playwright test that presses a button or a link right after `page.goto` can land before React has hydrated it: the server's HTML takes the press and nothing happens, which fails on a loaded CI runner only. Wait for the element first with `hydrated(locator)` from `web/tests/e2e/hydration.ts`, as the phone menu tests do. A test that first waits for something the page draws on the client has already waited.
