---
name: use-case-solution-research
description: Research and compare vendors against a business use case, classify direct, industry, and technology relevance, and prepare an evidence-backed longlist for review and approved spreadsheet inclusion. Use for solution scouting and vendor landscape research.
---

# Use-case solution research

Turn a business problem into a source-backed vendor longlist. Work with the user to confirm the use-case mapping and select entries for an eventual sheet. Apply this to any industry; do not hardcode Nestle, POD, or a vendor list.

## Working defaults

- Research globally, with additional discovery in Asia and particular attention to Southeast Asia and Vietnam. A user's specified geography overrides this default.
- Consider startups, ISVs, solution providers, IT outsourcing companies, system integrators, established technology companies, and other credible providers. Include AI-native offerings where relevant without excluding non-AI approaches that solve the problem.
- Handle one use case at a time unless the user requests multiple.
- Keep a cumulative candidate list. Do not replace earlier candidates when broadening geography or changing priorities. Deduplicate company aliases; retain candidates with a credible potential fit and explain uncertainty. Correct or flag unsupported entries rather than silently deleting them.
- Keep researched candidates separate from entries approved for sheet inclusion. A request to research, broaden, or show a table does not approve writing those candidates to a sheet.

## Confirm the use case

Read the supplied source through an appropriate available connector or file workflow. Extract the actual current process, parties, input documents/systems, pain, desired outputs, and human review requirements. Distinguish source facts from interpretation. Clarify ambiguities that materially change vendor fit; do not invent missing requirements.

Propose a short stable ID and business name, such as `UC01 — Proof of Delivery (POD) Reconciliation`. Obtain the user's confirmation before applying a newly proposed name to vendor tables. Reuse an already approved name verbatim without asking again. Do not substitute individual vendor capabilities for the use-case name.

Translate the workflow into a small set of functional requirements for evaluating fit. Distinguish required outcomes from optional integration preferences. For document workflows, distinguish reading a received document, matching it against records, detecting an expected document that never arrived, and managing exceptions. An ePOD capture tool does not automatically reconcile legacy paper and Excel records.

## Discover and investigate candidates

Search the problem and workflow, not only the assumed technology category. Cover:

- Purpose-built solutions for the exact process, including approaches that remove the manual process upstream.
- Similar workflows in the user's industry and its distributors or service providers.
- Enabling technology and implementation providers that can assemble the needed workflow.

Use global searches plus targeted Asian country and local-language searches where useful. Search regional customer cases and delivery teams, not just headquarters. Avoid quotas that inflate the list with weak matches.

Run a dedicated discovery pass for early-stage and AI-native companies alongside established providers. Search regional startup ecosystems, accelerator cohorts, investor portfolios and product launches using the functional requirements. Use these channels to discover candidates, then verify their relevant capabilities; funding, accelerator membership and AI-native positioning alone do not establish fit. Do not require a public enterprise case study before investigating an emerging provider.

For each credible candidate, examine current product capabilities, customer cases, implementation scope, company identity and founding year, regional presence, and funding information. Prefer company product documentation, customer-authored references, named customer cases, official announcements, investor disclosures, and filings. Use reputable secondary reporting for gaps and identify material uncertainty. Do not treat a search snippet or customer logo as proof of an exact deployment.

For emerging companies, also examine substantive demos, technical evaluations and pilots. State what each source actually demonstrates, its scope and whether it is vendor-reported or independently assessed. Distinguish demonstrated capability from deployment evidence and unsupported marketing claims. Lack of public customer cases is a validation gap, not automatic exclusion; retain a candidate when relevant enabling capability is credibly documented.

Batch independent searches, then follow up on important gaps. Broaden discovery until the main solution approaches and requested regions are covered and additional searches mostly yield duplicates or unsupported fits. Report remaining coverage gaps; never imply the landscape is exhaustive.

Before delivery, check whether discovery disproportionately favoured mature providers or merely relabelled scaleups as early-stage startups. If so, deepen emerging-company discovery, especially in the requested regions, or explain the remaining coverage and evidence gaps. Do not impose a startup quota or include weak candidates for balance. Keep discovery breadth separate from evidence strength.

## Assign one primary bucket

Use exactly these values in `Bucket Type`:

| Bucket | Assignment rule |
| --- | --- |
| Direct Relevance | Documented product or delivery scope covers the required use-case outcomes and directly addresses the problem. Normal configuration does not disqualify it; substantial custom development or an unverified essential capability does. |
| Industry Relevance | A credible reference shows a similar process in the user's industry or directly relevant industry supply chain, but the full use-case fit is unestablished. |
| Technology Capability | Relevant enabling capabilities or implementation expertise are documented, but neither the full use-case fit nor a relevant industry deployment is established. |

Choose the strongest supported bucket in that order. Explain other relevant strengths in the evidence cell. Complete documented product functionality can qualify as Direct Relevance without a customer deployment. Clearly state whether the evidence is product documentation, a named deployment, or an anonymised case; do not present documented functionality as deployment-proven. No bucket guarantees performance on the user's data.

Apply the same relevance standards regardless of company maturity. Being early-stage or AI-native does not justify Direct Relevance; complete documented functionality can qualify, while partial capabilities belong in the strongest supported bucket with precise validation gaps.

Do not weaken the user's definition of Direct Relevance to fill that bucket. If only part of the workflow is proven, state the missing part and use Industry Relevance or Technology Capability. An empty Direct Relevance bucket is acceptable. Industry relevance must concern a similar workflow; broad sector experience alone is insufficient. Ask only if a genuinely ambiguous adjacent industry would materially affect the classification.

## Prepare the review table

Read [references/table-schema.md](references/table-schema.md) when preparing or updating the table. Use the ten default columns there, including Year Founded after HQ Country, unless the user specifies a different schema. Include a source link close to the claim it supports. Keep vendor facts, fit assessment, and validation gaps distinguishable in each row.

Present the updated cumulative table, identify additions and meaningful corrections, and briefly explain which candidates merit closer evaluation. Priority is a recommendation, not an exclusion or an approval decision. Do not claim that an unproven solution is unavailable.

Distinguish recommendations for strongest deployment evidence from those for most promising emerging capability. Explain the capability and validation tradeoffs; do not rank an emerging provider lower solely because it lacks public enterprise cases. Use the existing Type field to distinguish company maturity rather than adding columns by default.

Track the approved use-case name, source requirements, candidate identities, sources and research dates, bucket rationale, and approved company selections in the current working context or a workspace research record as appropriate. Keep stale facts dated until refreshed.

## Approved sheet inclusion

Follow the user's actual approval workflow. By default, show concrete rows for review and ask which companies to include before creating or populating the final sheet. Explicit instructions such as “include all 26” or a named subset are sufficient; do not ask again for the same authorized entries. If the user directly authorizes automatic inclusion, follow that instead of imposing an extra approval step.

Only approved candidates enter the final sheet. New discoveries remain candidates until approved, even when an existing sheet is being maintained. Resolve the destination only when needed. Use an appropriate spreadsheet skill/tool, preserve unrelated content, and verify the written rows, exact use-case names, bucket values, hyperlinks, and approval scope. Do not modify the source use-case workbook unless requested.

Before delivering research or a sheet, check that every row has a supported fit rationale, correctly distinguished headquarters/presence, a sourced founding year or explicit uncertainty, dated funding where available, and accessible source links. Unknown means unverified, not absent or zero.
