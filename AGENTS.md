# BeyondPilot repository guide

## Where to look

- Product scope from the client: [docs/brief/](docs/brief/BeyondPilot-Vendor-Product-Brief-and-Scope.md).
- Engineering rules for all code: [docs/conventions.md](docs/conventions.md); topic guidelines under [docs/guidelines/](docs/guidelines/).
- Why a decision was made: accepted ADRs under [docs/decisions/](docs/decisions/).
- Running the system locally: [docs/runbooks/development-runtime.md](docs/runbooks/development-runtime.md).
- Releases and the staging host: [docs/runbooks/ci-cd.md](docs/runbooks/ci-cd.md).
- What the team studied before designing, with its sources: [docs/research/](docs/research/README.md).

## Area guides

- Backend work in `backend/`: follow [docs/guidelines/backend.md](docs/guidelines/backend.md).
- Frontend work in `web/`: follow [web/AGENTS.md](web/AGENTS.md).
- Design work in Figma: follow [docs/guidelines/figma.md](docs/guidelines/figma.md).

## Operating rules

- Classify knowledge before writing it: what exists in `ARCHITECTURE.md` or `docs/specs/`; product intent in `docs/vision.md`; reusable policy in `docs/conventions.md` or `docs/guidelines/`; change-local reasoning in the active increment; planned work only in the roadmap or an increment, never as a current fact ([operating model](docs/guidelines/operating-model.md)).
- Reuse before building: check the framework, the installed libraries and the existing components first ([reference-based design and scope control](docs/conventions.md#reference-based-design-and-scope-control)).
- Add no speculative structure: no empty module or package, no single-implementation interface, no temporary runtime mode or convenience endpoint ([change design](docs/conventions.md#change-design)).
- A change that adds or alters a business capability starts with an increment directory holding `design.md` and `plan.md`; a new module starts with [boundary discovery](docs/conventions.md#boundary-discovery).
- Work is tracked in Linear. Name the branch as the issue suggests (`<user>/bey-<n>-<slug>`) and write commit subjects as `type(scope): summary (BEY-<n>)`.
- CI runs on every branch push. `main` receives only commits whose CI run is green: fast-forward `main` onto the verified branch, or open a pull request when a review is wanted.
- Run the gates before pushing: `./gradlew :backend:check` for the backend and `pnpm --dir web check` for the web ([testing guideline](docs/guidelines/testing.md)). An API change refreshes `openapi.yml` and the generated web client in the same change.
- Work on a branch in its own `git worktree` when another session may be using this checkout, and never switch the branch of a checkout you did not start.
- Never write a password, token, private key or other secret value to Git, documents, Linear, logs or command history; record only where the secret is managed ([data and security](docs/conventions.md#data-and-security)).
- Write repository documents in English, and update them in the change that makes them true.
- Record an ADR only after the decision is accepted and implementation has started. ADRs are append-only; supersede one with a new ADR.
- Clone repositories studied for reference into the git-ignored `.tmp/` folder; never commit them.
