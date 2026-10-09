# AI models: a fallback model per task

Status: proposed on 9 October 2026 ([plan](plan.md)). Tracked in Linear as BEY-101. It changes the `ai` module only and adds no module and no dependency between modules, so there is no boundary discovery.

## What it does

A task uses one model today. When that model or its provider cannot answer, the task fails and nothing else is tried. With this change an operator may give each task a second model, and a call the main model cannot answer is answered by that one.

| Part            | What an operator sees                                                                                 | What the application gets                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Models by task  | Each task has its main model and, next to it, an optional fallback model with its own reasoning level | A chat client that answers from the fallback when the main model cannot             |
| State of a task | A note on the task while it is answered by its fallback, and until when                               | Nothing to do: callers ask for a task's client as before                            |
| Usage           | Nothing yet                                                                                           | One row per attempt, with the model that was called and whether it was the fallback |

## Domain story

1. An operator opens Admin › AI › Providers. Under Models by task, Matching has its model. They choose a fallback model for it, on another provider, and a reasoning level.
2. Matching asks for the client of its task and judges candidates. Each call goes to the main model.
3. The main model's provider starts answering 503. The call that met the failure is asked again from the fallback model and answers. The caller sees one answer.
4. For a short time the calls that follow go straight to the fallback, so a run does not wait for the same failure on every call.
5. When that time is over the next call tries the main model again. If it answers, the task is back on its main model.
6. Meanwhile the operator sees on the task that it is answered by its fallback.

Failure and recovery:

- **The main model fails and there is no fallback:** the call fails as it does today.
- **Both fail:** the call fails with the main model's failure. Both attempts are recorded.
- **The request itself is refused** (malformed, context too long): the fallback is not asked, since it would be refused the same way; the caller gets the failure.
- **The main model is unset, or its provider is switched off or has no readable key, and a fallback is chosen:** the task runs on the fallback. A task with neither still does not run; there is no silent default.
- **The fallback's model or provider is deleted:** the fallback becomes unset, as the main model does today.
- **The application restarts:** it forgets which models were resting. The cost is one failed attempt on the main model.

## Glossary

| Term           | Meaning                                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| Main model     | The model a task uses. What "task model" meant until now                                                    |
| Fallback model | The model that answers a call the main model could not. Chosen by an operator; optional                     |
| Attempt        | One call to one model. A call that falls back is two attempts                                               |
| Failure kind   | What a failed attempt was, read from the status or the exception type: see the table below                  |
| Rest           | The time after a failure during which a model is not tried and the task's calls go straight to the fallback |

## Failure kinds

Each adapter reads the kind from its own SDK's exception, since only it knows them (`OpenAIServiceException.statusCode()`, `AnthropicServiceException.statusCode()`, their IO exceptions). The provider's message is never read: it can repeat the request, and the conventions forbid matching on message text.

| Kind               | Read from                                                          | Fall back | Rest of the model                                                                                                                          |
| ------------------ | ------------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `CREDENTIAL`       | 401, 403                                                           | Yes       | 2 minutes                                                                                                                                  |
| `BILLING`          | 402                                                                | Yes       | 2 minutes                                                                                                                                  |
| `MODEL_MISSING`    | 404                                                                | Yes       | 2 minutes                                                                                                                                  |
| `RATE_LIMITED`     | 429                                                                | Yes       | The provider's `retry-after` when it gives one, at most 30 minutes; otherwise 5 seconds, doubling on each failure in a row up to 5 minutes |
| `UNAVAILABLE`      | Any 5xx, a timeout, a failed connection                            | Yes       | 30 seconds                                                                                                                                 |
| `INCOMPATIBLE`     | The SDK's invalid-data exception: an answer that is not the API's  | Yes       | 30 seconds                                                                                                                                 |
| `REQUEST`          | Any other 4xx                                                      | No        | None                                                                                                                                       |
| Not the provider's | Any other exception, such as one raised while the request is built | No        | None                                                                                                                                       |

The durations are settings with these defaults. A successful attempt ends a model's rest and resets the doubling.

The SDK retries a failed call once on the same model before raising (`maxRetries(1)`, unchanged). The fallback is asked after that.

## Commands, facts and consistency

| Command (operator)     | Rule checked in the same transaction                                                                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Choose a task's models | As today for the main model. For the fallback: there is a main model; it is another model; its provider is enabled with a key; it reads images when the task sends pictures; the row's version |

| Fact                | Who reacts                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| An attempt finished | A usage row is written for it, with the model called, in its own transaction; a row that cannot be written never fails the call |
| An attempt failed   | The model rests for the time its failure kind gives. Kept in memory, per model                                                  |

No event crosses a module boundary.

## Data and invariant owner

`ai` owns both tables and stays their only writer.

| Table           | Change                                                                                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai_task_model` | Gains `fallback_model_id` (to `ai_model`, set to null when the model is deleted) and `fallback_reasoning_effort`. A check refuses a fallback equal to the main model |
| `ai_usage`      | Gains `fallback`, true when the attempt went to the task's fallback model. Existing rows are false                                                                   |

Which models are resting is not stored. Each running instance keeps its own in memory, and losing it costs one attempt.

## How it is built

- **A `ChatModel` that falls back.** `AiModels.chat` builds the task's client on a `ChatModel` that holds the main model and the way to reach the fallback. On a call it asks the main model unless it is resting; on a failure whose kind falls back, it rests the model and asks the fallback. Callers (`MatchingRuns`, `Requirements`, `DocumentPages`) do not change.
- **Recording moves from the advisor to the model.** Today one `ChatClient` advisor records each call with the model fixed when the client was built. Only below the client is it known which model answered, so each model is wrapped by a recorder that writes one row per attempt. Tool calls run inside the model's call in Spring AI 2, so a row still covers the whole exchange, as the advisor's did. This replaces the BEY-92 decision "one advisor records every call"; what a row holds does not change.
- **The fallback's client is borrowed when first needed** and given back when the task's client is closed, through the same leased cache (`ModelClients`). If every client is in use the fallback counts as unavailable and the main model's failure is raised.
- **`ChatAdapter` gains one method** that names the failure kind of an exception. The table of statuses is one shared class with its own test; the two adapters only unwrap their SDK's exception.
- **`AiModels.available(task)`** is true when the main model or the fallback can be used.
- **`AiChat.modelName()`** stays the name of the model the client starts on: the main model, or the fallback when the main model cannot be used at all. A matching run keeps recording that name; which model answered each call is in `ai_usage`, by the run's identifier.
- **Streaming** is not used by any caller. A streamed call goes to the main model, or to the fallback while the main model rests, and does not switch midway.

## API and screen

- `PUT` of a task's model takes `fallbackModelId` and `fallbackReasoningEffort` beside the existing fields; the task in the settings response returns them and `fallbackInUseUntil`, set while the main model rests.
- New failures: `AI_FALLBACK_SAME_AS_MAIN`, `AI_FALLBACK_WITHOUT_MAIN`. An unusable fallback and one that cannot read images reuse `AI_MODEL_UNAVAILABLE` and `AI_MODEL_WITHOUT_VISION`.
- The audit record of a task model change names the fallback as well.
- Web: in the task block, a second Model selector labelled as the fallback, with the main model disabled in it and a choice of none; a line of text when both models are on one provider; a note while the task is answered by its fallback. The selector is the assistant-ui component the block already uses, which holds one value and has no notion of a fallback, so two instances stand side by side. No new Figma screen: it is a second instance of an approved component in an approved block (agreed with Đạt on 9 October).

## Decisions

| Decision                                                                | Why                                                                                                                                                                                                |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A fallback per task, not one default model for every task               | Tasks need different things: document reading needs a model that reads images, matching needs reasoning and a long context. One default would have to satisfy all of them, and there are two tasks |
| Two levels at most                                                      | Calls are paid per token; one spare is what an outage needs. Chains of any length serve routers that spread quota over free plans                                                                  |
| The fallback is asked for the failed call itself, not only the next one | A matching run or a deck being read should not lose the item it was on                                                                                                                             |
| A model rests after a failure, for a time that depends on the kind      | Without it a run of a hundred calls waits for the same timeout a hundred times. A missing model should rest longer than a busy one                                                                 |
| Failure kinds are a table of their own, read from status and type       | It can be tested alone, and no behaviour hangs on a provider's wording                                                                                                                             |
| An exception that is not the provider's does not fall back              | A request that cannot be built fails the same way on any model, and falling back would hide the defect                                                                                             |
| One matching run may be judged by two models                            | Accepted with Đạt on 9 October: finishing the run is worth more than one model throughout, and `ai_usage` says which model answered each call                                                      |
| Embeddings get no fallback                                              | Vectors from two models cannot be compared; switching would corrupt the search index                                                                                                               |

## Left out

- A third level, named chains, round-robin and reordering models by capability at call time.
- Keeping the resting models across a restart or across instances.
- Switching a streamed answer midway.
- An OCR service as a reader of document pages: [BEY-102](https://linear.app/beyondpilot/issue/BEY-102), which builds on this.
- A screen for usage; the new column waits for it.

## References read

- 9router v0.5.99 (`.tmp/9router`, read, not used): `open-sse/services/combo.js`, `open-sse/services/accountFallback.js`, `open-sse/config/errorConfig.js`. Taken: the separate rule table, the rest per model by kind of failure, the provider's reset time with a cap. Not taken: named combos, round-robin, rules that match the error message.
- Spring AI 2.0.1 sources: `OpenAiChatModel` lets the SDK's exceptions through unwrapped and has no fallback between models; nothing in its modules offers one.
- `openai-java` 4.49.0 and `anthropic-java` 2.52.0: `*ServiceException.statusCode()` and `headers()`, `*IoException`, `*InvalidDataException`.
- assistant-ui's Model selector documentation and the installed `model-selector.tsx`.
