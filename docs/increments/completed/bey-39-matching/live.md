# Matching: a run seen while it works

Part of [the matching design](design.md), step 12 of [the plan](plan.md). Tracked in Linear as BEY-39. Approved by Đạt on 9 October.

## Why

A run takes three to five minutes. The page reloads its data every five seconds, so it is current, but it does not read as working: for the first forty seconds one sentence stands still, and afterwards rows appear without a sign, most of them in a folded group or nowhere, because a solution that fits no group is not shown. Đạt, watching a run on staging: "only this line is real time; there is no feeling that what is found shows up one after another".

## What was studied

- Clay shows a bar per enrichment column split into succeeded, running and failed, and one for the table ([run progress](https://clay.com/university/guide/run-progress-ui)): the unit of work is visible, not only the total.
- Writing on long agent runs ([Slow AI](https://www.uxtigers.com/post/slow-ai), [agent UX patterns](https://inference.sh/blog/ux-agent-ux-patterns)) asks for named steps, partial results shown as they arrive and marked as not final, a clear end, and warns against updates so fast they are noise.
- MemoryOS streams its chat from Spring MVC: a controller that answers `Flux<ServerSentEvent>` with an event name, an identifier and a heartbeat comment (`ChatStreamController`). Behind it is a buffer that replays events, which a chat of hundreds of tokens a second needs.

## Decisions

| Decision | Why |
| --- | --- |
| Server-sent events from Spring MVC, a controller answering `Flux<ServerSentEvent>`; no WebFlux, no new library | The shape MemoryOS uses. Reactor is on the class path with Spring AI, and Spring MVC writes a `Flux` as a stream without a timeout |
| An event says that something changed and what kind of change; it carries no state. The page then reads `GET /api/matching/use-cases/{id}` again | One place decides what a member may read. A run has about 45 changes and every one is in the database when it is told, so there is nothing to replay: a page that lost its stream reads the state when it is back |
| The one exception: `reading` carries the identifier of the solution whose judgment starts, and `read` the same when it ends | Which solutions are being read now is not stored, and it is what makes the list look at work. The identifier is one the reader already has in the list |
| Changes are told inside the application, through one Reactor sink that the stream of each use case filters | The backend is one instance on staging and in production. With a second instance a page would still be current within five seconds, through the reload that stays |
| A change made in a transaction is told after the commit | The page reads the state at once; told earlier, it would read the state before the change |
| `Run` gains `stage`: `brief`, `search` or `reading` while a run works | A page opened in the middle of a run must name the stage without having heard the events |
| The stream is opened for as long as the page is open, not only during a run | A run that starts after a brief settles, and what a colleague shortlists or removes, show without a reload |
| The reload every five seconds runs only while the stream is not open | It is the fallback for a proxy that holds the stream back; with the stream open it would only repeat work |
| The response carries `X-Accel-Buffering: no` and `Cache-Control: no-store` | The reverse proxy in front of staging and production is nginx, which buffers a response unless told not to |

## What the page shows during a run

1. **The stages by name**, in the place of one sentence: Reading your brief → Searching the solutions → Reading each solution (16 of 40) → Done. The stage at work is marked; the stages before it are ticked.
2. **Every solution found is a row at once**, in a group named "Being read", with its name and logo. A row whose judgment is under way says so. When it is read it leaves that group: it enters its own group with a short highlight, or it leaves the list when it fits none.
3. **A line of what just happened**, under the stages: "Added fileAI to Strong fit". Several changes that arrive together are one line ("3 more read, 1 added to Strong fit"). It is a polite live region.
4. **The last group is open** while a run works, so that rows are seen arriving.
5. Motion is short (about 200 ms in, a highlight that fades in two seconds) and is not played for a reader who asked for reduced motion; nothing depends on it.

## Left out

- Stopping a run. It needs a new state of a run and a rule for what a stopped run keeps; it is a capability of its own.
- The model's sentence written letter by letter. A judgment is a typed answer checked by code before it is kept, so there is nothing true to show before it ends.
- More than one instance of the backend. The sink is local; see the decision above.

## Verification

- `MatchingRunTest`: a run tells its changes in order (brief read, solutions found, each one being read and read, the end), and `stage` follows; a member of another organization is answered 404 on the stream.
- A unit test of the changes: a stream hears the changes of its use case only, and a change made in a transaction is heard after the commit.
- `matching.spec.ts` with the stub: a page with a run at work shows the stages and the rows being read; an event makes a row enter its group; with the stream closed the page still becomes current.
- On staging after the merge: a run watched from start to end, in the browser, through the reverse proxy.
