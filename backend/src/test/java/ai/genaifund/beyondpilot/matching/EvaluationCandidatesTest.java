package ai.genaifund.beyondpilot.matching;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import ai.genaifund.beyondpilot.matching.EvaluationCandidates.Candidate;
import ai.genaifund.beyondpilot.proposal.ProgramSubmission;
import ai.genaifund.beyondpilot.proposal.SentUseCaseProposal;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Who a program's evaluation assesses: an organization with one solution, through every route it used (BEY-234). */
class EvaluationCandidatesTest {

	private static final UUID PROGRAM = UUID.randomUUID();

	private static final UUID USE_CASE = UUID.randomUUID();

	private static final Instant MONDAY = Instant.parse("2026-10-12T03:00:00Z");

	@Test
	void oneProductSentBothWaysIsOneCandidateThatReadsBoth() {
		UUID org = UUID.randomUUID();
		UUID product = UUID.randomUUID();
		ProgramSubmission application = submitted(org, product, 1);
		SentUseCaseProposal proposal = proposal(org, product);

		List<Candidate> candidates = EvaluationCandidates.of(List.of(application), List.of(proposal));

		assertThat(candidates).singleElement().satisfies(candidate -> {
			assertThat(candidate.organizationId()).isEqualTo(org);
			assertThat(candidate.solutionId()).isEqualTo(product);
			assertThat(candidate.read()).extracting(EvaluationCandidates.Entry::id)
				.containsExactly(application.id(), proposal.id());
		});
	}

	@Test
	void aFinishedProposalIsNotHiddenBehindAnUnfinishedApplication() {
		UUID org = UUID.randomUUID();
		UUID product = UUID.randomUUID();
		ProgramSubmission draft = draft(org, product);
		SentUseCaseProposal proposal = proposal(org, product);

		Candidate candidate = EvaluationCandidates.of(List.of(draft), List.of(proposal)).getFirst();

		assertThat(candidate.records()).extracting(EvaluationCandidates.Entry::id)
			.containsExactly(proposal.id(), draft.id());
		assertThat(candidate.read()).extracting(EvaluationCandidates.Entry::id).containsExactly(proposal.id());
	}

	@Test
	void twoProductsOfOneCompanyAreTwoCandidatesAndAProposalOfBothCountsForEach() {
		UUID org = UUID.randomUUID();
		UUID chatbot = UUID.randomUUID();
		UUID ocr = UUID.randomUUID();
		SentUseCaseProposal both = proposal(org, chatbot, ocr);

		List<Candidate> candidates = EvaluationCandidates.of(List.of(submitted(org, chatbot, 2)), List.of(both));

		assertThat(candidates).extracting(Candidate::solutionId).containsExactlyInAnyOrder(chatbot, ocr);
		assertThat(candidates).allSatisfy(candidate -> assertThat(candidate.records())
			.extracting(EvaluationCandidates.Entry::id)
			.contains(both.id()));
	}

	@Test
	void aDraftAloneIsNoCandidate() {
		UUID org = UUID.randomUUID();

		assertThat(EvaluationCandidates.of(List.of(draft(org, UUID.randomUUID())), List.of())).isEmpty();
		assertThat(EvaluationCandidates.of(List.of(), List.of())).isEmpty();
	}

	@Test
	void aProposalWhoseSolutionsAreGoneJoinsItsOrganizationsOnlyCandidate() {
		UUID org = UUID.randomUUID();
		UUID product = UUID.randomUUID();
		SentUseCaseProposal orphan = proposal(org);

		Candidate candidate = EvaluationCandidates
			.of(List.of(submitted(org, product, 1)), List.of(orphan)).getFirst();
		assertThat(candidate.read()).extracting(EvaluationCandidates.Entry::id).contains(orphan.id());

		assertThat(EvaluationCandidates.of(List.of(submitted(org, UUID.randomUUID(), 1),
				submitted(org, UUID.randomUUID(), 1)), List.of(orphan)))
			.allSatisfy(each -> assertThat(each.records()).extracting(EvaluationCandidates.Entry::id)
				.doesNotContain(orphan.id()));
	}

	@Test
	void theFingerprintChangesWithANewVersionAnEditOrABriefAndNotWithADraft() {
		UUID org = UUID.randomUUID();
		UUID product = UUID.randomUUID();
		ProgramSubmission first = submitted(org, product, 1);
		SentUseCaseProposal proposal = proposal(org, product);
		String base = EvaluationCandidates.of(List.of(first), List.of(proposal))
			.getFirst()
			.fingerprint(1, List.of("brief-a", "brief-b"));

		assertThat(EvaluationCandidates.of(List.of(first), List.of(proposal))
			.getFirst()
			.fingerprint(1, List.of("brief-b", "brief-a"))).as("same material, briefs in another order")
			.isEqualTo(base);
		assertThat(EvaluationCandidates.of(List.of(first, draft(org, product)), List.of(proposal))
			.getFirst()
			.fingerprint(1, List.of("brief-a", "brief-b"))).as("a draft is not read").isEqualTo(base);
		ProgramSubmission second = new ProgramSubmission(first.id(), PROGRAM, org, product, "submitted", 2,
				"under_review", MONDAY.plusSeconds(60), first.sent());
		assertThat(EvaluationCandidates.of(List.of(second), List.of(proposal))
			.getFirst()
			.fingerprint(1, List.of("brief-a", "brief-b"))).as("submitted again").isNotEqualTo(base);
		SentUseCaseProposal edited = new SentUseCaseProposal(proposal.id(), USE_CASE, org, MONDAY.plusSeconds(3600),
				"Edited", null, null, proposal.solutions(), null);
		assertThat(EvaluationCandidates.of(List.of(first), List.of(edited))
			.getFirst()
			.fingerprint(1, List.of("brief-a", "brief-b"))).as("proposal edited").isNotEqualTo(base);
		assertThat(EvaluationCandidates.of(List.of(first), List.of(proposal))
			.getFirst()
			.fingerprint(1, List.of("brief-a", "brief-c"))).as("a brief changed").isNotEqualTo(base);
		assertThat(EvaluationCandidates.of(List.of(first), List.of(proposal))
			.getFirst()
			.fingerprint(2, List.of("brief-a", "brief-b"))).as("prompt changed").isNotEqualTo(base);
	}

	private static ProgramSubmission submitted(UUID org, UUID solution, int version) {
		return new ProgramSubmission(UUID.randomUUID(), PROGRAM, org, solution, "submitted", version, "under_review",
				MONDAY, new ProgramSubmission.Sent(
						new ProgramSubmission.Organization("Northwind Labs", "company", "Vietnam", "10-49", null, null),
						new ProgramSubmission.Solution("RenewIQ", "Renewal reminders", null, "in_pilot", null), null,
						List.of(), null, List.of()));
	}

	private static ProgramSubmission draft(UUID org, UUID solution) {
		return new ProgramSubmission(UUID.randomUUID(), PROGRAM, org, solution, "draft", 0, "under_review", MONDAY,
				null);
	}

	private static SentUseCaseProposal proposal(UUID org, UUID... solutions) {
		return new SentUseCaseProposal(UUID.randomUUID(), USE_CASE, org, MONDAY, "How we would answer it", null, null,
				Arrays.stream(solutions)
					.map(id -> new SentUseCaseProposal.Solution(id, "Product " + id, null))
					.toList(),
				null);
	}

}
