# Proposals: plan

Design: [design.md](design.md). Tracked in Linear as BEY-37.

| #   | Step                                                                                                                                                                                         | State |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | This design and plan                                                                                                                                                                         | Done  |
| 2   | Backend and web: `V11`; review decides listing only; members write solutions; a light organization for one person or a team; a solution's deck, demo link, built-with and traction           | Open  |
| 3   | Backend and web: `V12`; a program's questions, fixed once applications open; the Questions tab of Settings                                                                                   | Open  |
| 4   | Backend: `V13`; the `proposal` module: start, save, set up an individual or a team, submit with its version and email, withdraw, my applications; `openapi.yml` and the web client refreshed | Open  |
| 5   | Web: Apply steps 1 to 4 with their states                                                                                                                                                    | Open  |
| 6   | Web: the receipt, My applications and an application's page with Withdraw; Apply on a program page leads to the flow (the Tasco challenge keeps its interim form until 15 October)           | Open  |
| 7   | Documents made true: `docs/tests/proposal.md`, the matrices of organization and solution, `ARCHITECTURE.md`                                                                                  | Open  |

Each step is one or more commits, pushed as it is finished, on one branch with one pull request.

## Verification

- `./gradlew :backend:check`, the proposal tests speaking HTTP against PostgreSQL:
  - an application is started, saved step by step, submitted with a version and an email, changed and submitted again, withdrawn and submitted again;
  - a save or a submission after the close, a submission missing a required answer, a contact detail or a solution, and a second application of the same person to the same program are refused;
  - an individual's organization is made from their name; a member of an organization waiting for review applies and writes its solution;
  - the questions of a program are refused once its window has opened.
- `pnpm --dir web check` and the end-to-end tests at desktop and mobile widths, with axe.

## Needed from outside the code

| What                                                                         | For                                               | Where it is managed    |
| ---------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------- |
| The first program that takes applications on BeyondPilot, with its questions | A live application after 9 October                | Entered by an operator |
| The export of the interim form's applications                                | Importing the Tasco applications after 15 October | Asked in BEY-41        |
