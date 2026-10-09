# Matching: how the prompts were worded, and what was measured

Read and measured on 9 October 2026 for [BEY-39](../increments/active/bey-39-matching/design.md), after the first real runs on staging gave no Direct candidate, and then twenty-one. It records why prompt version 4 says what it says. The model was `cx/gpt-6.1-sol` through 9Router at medium reasoning for every call, one call a candidate.

## What went wrong on staging

One use case, "AI-based CRM next-best-action" (banking), 40 candidates a run.

| Version | Required capabilities the model listed | Direct | Industry | Technology | None | What was wrong |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Five: recommending retention, cross-sell, up-sell, top-up and repeated offers, one each | 0 | 1 | 12 | 27 | A rule added after the probe, "split a sentence that joins several", split one function into its variants |
| 2 | Two; the second listed all five kinds of offer | 0 | 2 | 12 | 26 | The judge asked each vendor's material to name all five: 0 of 40 met it, 34 partly, among them products whose own words are "next-best offers" and "cross-sell and up-sell actions" |
| 3 | Two, without the kinds, the industry or the purpose | 21 | 2 | 13 | 4 | The capability was so wide that tools for scoring sales leads met it. Its wording was the example sentence of the prompt, which had been taken from this very use case |

Every quote was found in the vendor's material in all three runs. The fault was never invention; it was what the model was asked to look for.

## How other tools word a judge

Read from source on 9 October (file paths are in the repositories named).

- **promptfoo `llm-rubric`** (`src/prompts/grading.ts`): the reason comes before the verdict in the answer, `{reason, pass, score}`.
- **OpenAI evals `closedqa`**, copied by LangChain's criteria evaluator: "First, write out in a step by step manner your reasoning about the criterion to be sure that your conclusion is correct."
- **OpenAI evals `fact`**, copied by Braintrust autoevals: the levels are relations between two texts, not grades; "a subset ... fully consistent with it" is its own level, apart from a disagreement.
- **DeepEval faithfulness**: three levels that keep absence apart from contradiction.
- **TruLens groundedness**: the supporting sentence is asked for before the score, and the prompt guards both ways: indirect evidence may count, and must not be mistaken for direct support.
- **Ragas**: makes criteria atomic in a step of its own before judging; its rubrics give one sentence a level.
- **Anthropic's documentation**: detailed rubrics, word-for-word quotes before the task, and long material before the question.
- **candisift** (already in [the first research note](2026-10-09-matching-references-and-probe.md)): "by MEANING not keyword string match".
- **Spring AI 2.0 reference**, prompt engineering patterns and structured output: a `reasoning` field in the typed answer, a low temperature for work that must repeat, self-consistency (several samples and a vote) for critical decisions, and native structured output through `AdvisorParams.ENABLE_NATIVE_STRUCTURED_OUTPUT`.

What they share: evidence or reasoning before the verdict; each level one sentence about what the evidence shows; and criteria assumed to be atomic. None handles a criterion that holds a list of examples, which is where versions 1 and 2 failed.

## Biases of a model that judges, and what one call can do about them

| Bias | What one call can do | Source |
| --- | --- | --- |
| Leniency when in doubt | A quote is mandatory and code checks it; absence is a level of its own | Thakur et al., arXiv 2406.12624 |
| Position and order | Say that order means nothing; measure by reversing | Zheng et al., arXiv 2306.05685; Ye et al., arXiv 2410.02736 |
| Anchoring and halo between findings | Say that each finding stands alone; overall judgments last | Stureborg et al., arXiv 2405.01724 |
| Length and polish | Judge a quote, not a document; say so | Zheng et al.; Ye et al. |
| Name and authority | Tell the judge to ignore size, fame, awards and customer logos | Ye et al.; Koo et al., arXiv 2309.17012 |
| Instability between samples | One sample; a reason improves agreement with people | Stureborg et al.; Chiang and Lee, arXiv 2310.05657 |
| Text in the judged material that gives orders | The material is marked as data | Ye et al. |

No source was found that measures a judge being too literal about an enumerated requirement; the rules for that come from our own runs.

## What was measured

Throwaway scripts (`probe4.py`, `probe5.py`, git-ignored), the same provider and model, answers cached.

**Noise and order**, 18 candidates of the CRM use case, two required capabilities:

- The same question asked twice: 33 of 36 findings the same, 15 of 18 groups the same. This is the floor: about one finding in twelve changes for no reason.
- The requirements in reverse order: 33 of 36 findings the same. No effect of order beyond the noise.
- No invented quote in five runs of 18.

**The wording**, 40 candidates each:

| Use case | Wording | Required capabilities | Direct | Industry | Technology | None |
| --- | --- | --- | --- | --- | --- | --- |
| CRM next-best-action | A capability keeps its object and its purpose | 2 | 11 | 3 | 17 | 9 |
| CRM next-best-action | The same, and only the heart of the problem is required (version 4) | 1 | 10 | 2 | 17 | 11 |
| Visual inspection of automotive parts | A capability keeps its object and its purpose | 4, one of them a PLC integration, one root-cause analysis | 0 | 2 | 30 | 8 |
| Visual inspection of automotive parts | The same, and supporting functions are optional | 1 | 10 | 0 | 20 | 10 |

- The Direct candidates of the CRM use case are products for offers and retention to existing customers (VARTA, OnebyZero, Decyd, Reveza, Tribee, Meiro, Pango). Tools for scoring leads and coaching sales calls are in Technology or in no group, with the reason "a neighbouring job".
- The Direct candidates of the inspection use case are all visual inspection products for manufacturers (Zetamotion, Seewise, VIACT, Alphatok, Datature, Hutzper and others).
- A separate judgment, whether the product is made for the job the problem describes, changed no candidate's group in any run once the capability was specific. It is kept in the answer for people to read and is not part of the rule.

Not measured: the exact wording of version 4 on the inspection use case (the run was stopped by the machine running out of memory; the wording one step before it is the row above); whether the vendor's name moves a verdict; the same checks on more than two use cases. There is no reference list to say how many Direct candidates are right: GenAI Fund's own longlists are asked for in BEY-41.

## What version 4 says, and why

- **A capability says what the product does, to what, and what for.** Too narrow failed in version 2, too wide in version 3.
- **Its example comes from another field** (delivery notes in a warehouse). The example taken from the use case under test was copied into its requirements.
- **Variants are named by what they have in common, never listed.**
- **Only the heart of the problem is required**, usually one capability. A step on the way (analysing, predicting), an alert, a report and an analysis around it are optional; what the brief asks under integration, deployment or security is a constraint. With four required capabilities no inspection vendor reached Direct.
- **Each status is what the quote shows:** `met` when a buyer reading it would expect the product to do this; `partly` for a narrower or neighbouring thing, or a function only planned, built to order or a partner's; `not_shown` for absence.
- **By meaning, not by wording; one kind clearly shown is enough; the industry never changes a capability's status.**
- **A reason between the quote and the status**, one sentence, kept with the finding.
- **Sources first, the use case and its requirements after.**
- **Each finding stands alone; size, fame and polish are ignored.**

Not taken: worked examples in the judge's prompt (they pull verdicts towards their own labels, and the sources disagree on their worth); hiding the vendor's name (it costs code in the check of quotes, and is to be measured first); native structured output (every answer on staging was read with the current way, and a provider's strict schema cannot be tested without calling it); a temperature (not known to be accepted by this model at this reasoning level); several samples and a vote (several times the cost).

The rule of the groups did not change: Direct still needs every required capability met.
