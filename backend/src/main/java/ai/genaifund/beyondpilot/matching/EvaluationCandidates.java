package ai.genaifund.beyondpilot.matching;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;

import ai.genaifund.beyondpilot.proposal.ProgramSubmission;
import ai.genaifund.beyondpilot.proposal.SentUseCaseProposal;
import org.jspecify.annotations.Nullable;

/**
 * Who a program's evaluation assesses (BEY-234). A candidate is an organization with one solution, through every route
 * it used: its submitted application to the program and the proposals it sent to the program's use cases naming that
 * solution. A company that applied with one product and proposed another is two candidates; one product sent both ways
 * is one, so a finished proposal is not hidden behind an unfinished application (Kai's methodology, section 1).
 */
final class EvaluationCandidates {

	static final String APPLICATION = "application";

	static final String PROPOSAL = "proposal";

	private EvaluationCandidates() {
	}

	/**
	 * The candidates of a program, by organization then solution. A draft is listed with the candidate it belongs to
	 * and never read; a draft alone makes no candidate. A proposal whose solutions are all gone goes to its
	 * organization's only candidate, and to none when there are several or none.
	 */
	static List<Candidate> of(List<ProgramSubmission> applications, List<SentUseCaseProposal> proposals) {
		Map<Key, List<Entry>> byKey = new LinkedHashMap<>();
		for (ProgramSubmission application : applications) {
			if (application.submitted() && application.organizationId() != null
					&& application.solutionId() != null) {
				add(byKey, new Key(application.organizationId(), application.solutionId()),
						Entry.of(application));
			}
		}
		List<SentUseCaseProposal> withoutSolution = new ArrayList<>();
		for (SentUseCaseProposal proposal : proposals) {
			if (proposal.solutions().isEmpty()) {
				withoutSolution.add(proposal);
				continue;
			}
			for (SentUseCaseProposal.Solution solution : proposal.solutions()) {
				add(byKey, new Key(proposal.organizationId(), solution.id()), Entry.of(proposal));
			}
		}
		for (SentUseCaseProposal proposal : withoutSolution) {
			only(byKey, proposal.organizationId()).ifPresent(key -> add(byKey, key, Entry.of(proposal)));
		}
		for (ProgramSubmission draft : applications) {
			if (draft.submitted() || draft.organizationId() == null) {
				continue;
			}
			Key key = draft.solutionId() == null ? only(byKey, draft.organizationId()).orElse(null)
					: new Key(draft.organizationId(), draft.solutionId());
			if (key != null && byKey.containsKey(key)) {
				add(byKey, key, Entry.of(draft));
			}
		}
		return byKey.entrySet()
			.stream()
			.map(entry -> new Candidate(entry.getKey().organizationId(), entry.getKey().solutionId(),
					List.copyOf(entry.getValue())))
			.sorted(Comparator.comparing((Candidate candidate) -> candidate.organizationId().toString())
				.thenComparing(candidate -> candidate.solutionId().toString()))
			.toList();
	}

	private static void add(Map<Key, List<Entry>> byKey, Key key, Entry entry) {
		List<Entry> entries = byKey.computeIfAbsent(key, ignored -> new ArrayList<>());
		if (entries.stream().noneMatch(held -> held.kind().equals(entry.kind()) && held.id().equals(entry.id()))) {
			entries.add(entry);
		}
	}

	private static Optional<Key> only(Map<Key, List<Entry>> byKey, UUID organizationId) {
		List<Key> own = byKey.keySet().stream().filter(key -> key.organizationId().equals(organizationId)).toList();
		return own.size() == 1 ? Optional.of(own.getFirst()) : Optional.empty();
	}

	private record Key(UUID organizationId, UUID solutionId) {
	}

	/**
	 * One candidate and the records it combines, each keeping its own status.
	 * @param records its submitted application, its proposals and a draft, in that order of arrival
	 */
	record Candidate(UUID organizationId, UUID solutionId, List<Entry> records) {

		/** The records the model reads: a draft is listed, not read. */
		List<Entry> read() {
			return records.stream().filter(Entry::read).toList();
		}

		/**
		 * What an assessment of it rests on: the prompt version, what the use cases were read as, and each record
		 * read as it stands. The same material gives the same fingerprint, so an unchanged candidate is not asked
		 * again; a new version of the application, an edit of a proposal or a change of a brief gives another.
		 * @param briefs a fingerprint of each use case read against, in any order
		 */
		String fingerprint(int promptVersion, List<String> briefs) {
			Stream<String> parts = Stream.concat(
					Stream.of("evaluation", String.valueOf(promptVersion), organizationId.toString(),
							solutionId.toString()),
					Stream.concat(briefs.stream().sorted().map(brief -> "brief:" + brief),
							read().stream().map(Entry::stamped).sorted()));
			return Quotes.fingerprint(parts.toArray(String[]::new));
		}

	}

	/**
	 * A record a candidate combines, as its module names it.
	 * @param kind {@link #APPLICATION} or {@link #PROPOSAL}
	 * @param version the number of an application's last submission; 0 for a proposal or a draft never submitted
	 * @param stamp when what it holds last changed
	 * @param read false for a draft, which is listed and not read
	 */
	record Entry(String kind, UUID id, int version, Instant stamp, boolean read,
			@Nullable ProgramSubmission application, @Nullable SentUseCaseProposal proposal) {

		static Entry of(ProgramSubmission application) {
			return new Entry(APPLICATION, application.id(), application.version(), application.stamp(),
					application.submitted(), application, null);
		}

		static Entry of(SentUseCaseProposal proposal) {
			return new Entry(PROPOSAL, proposal.id(), 0, proposal.stamp(), true, null, proposal);
		}

		/** The record as it stands: an application by its version, a proposal by when it was sent or last edited. */
		String stamped() {
			return kind + ":" + id + ":" + (APPLICATION.equals(kind) ? String.valueOf(version) : stamp.toString());
		}

		ProgramSubmission requireApplication() {
			return Objects.requireNonNull(application, "not an application");
		}

		SentUseCaseProposal requireProposal() {
			return Objects.requireNonNull(proposal, "not a proposal");
		}

	}

}
