package ai.genaifund.beyondpilot.messaging;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import ai.genaifund.beyondpilot.messaging.dto.SubjectResponse;
import ai.genaifund.beyondpilot.messaging.persistence.MessagingRepository;
import ai.genaifund.beyondpilot.program.ProgramName;
import ai.genaifund.beyondpilot.program.ProgramService;
import ai.genaifund.beyondpilot.solution.SolutionDirectory;
import ai.genaifund.beyondpilot.talent.TalentDirectory;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

/**
 * What a conversation can be about, read from the modules that own it: a talent profile, a solution or a program. A
 * conversation starts from the public address of one of them, and shows it as its page says it now.
 */
@Component
class Subjects {

	private final TalentDirectory talent;

	private final SolutionDirectory solutions;

	private final ProgramService programs;

	Subjects(TalentDirectory talent, SolutionDirectory solutions, ProgramService programs) {
		this.talent = talent;
		this.solutions = solutions;
		this.programs = programs;
	}

	/**
	 * Who a first message would go to.
	 * @param recipientAccountId the person behind a talent profile; null for the other kinds
	 * @param recipientOrganizationId the organization that offers a solution; null for the other kinds
	 */
	record Target(String kind, UUID subjectId, String subjectName, @Nullable UUID recipientAccountId,
			@Nullable UUID recipientOrganizationId) {
	}

	/** The profile in the directory, the approved solution or the published program at an address; empty when none. */
	Optional<Target> at(String kind, String slug) {
		return switch (kind) {
			case MessagingRepository.TALENT -> talent.recipient(slug)
				.map(person -> new Target(kind, person.profileId(), person.name(), person.accountId(), null));
			case MessagingRepository.SOLUTION -> solutions.approvedAt(slug)
				.map(solution -> new Target(kind, solution.id(), solution.name(), null, solution.organizationId()));
			case MessagingRepository.PROGRAM -> programs.named(slug)
				.filter(ProgramName::published)
				.map(program -> new Target(kind, program.id(), program.name(), null, null));
			default -> Optional.empty();
		};
	}

	/**
	 * The subject as its public page says it now. Once the page is gone, a profile hidden or a solution taken down,
	 * only the name it had when the conversation started is left.
	 */
	SubjectResponse describe(String kind, UUID subjectId, String nameThen) {
		Optional<SubjectResponse> now = switch (kind) {
			case MessagingRepository.TALENT -> talent.indexed(subjectId)
				.map(profile -> new SubjectResponse(kind, profile.slug(), profile.name(), null, profile.headline(),
						profile.bio(), profile.country(), profile.city(), null, profile.industries(), profile.roles(),
						profile.skills(), 0));
			case MessagingRepository.SOLUTION -> solutions.indexed(subjectId)
				.map(solution -> new SubjectResponse(kind, solution.slug(), solution.name(),
						solution.organizationName(), null, solution.summary(), solution.country(), null,
						solution.maturity(), solution.industries(), List.of(), List.of(),
						solution.customerDeployments()));
			default -> Optional.ofNullable(programs.names(List.of(subjectId)).get(subjectId))
				.filter(ProgramName::published)
				.map(program -> named(kind, program.slug(), program.name()));
		};
		return now.orElseGet(() -> named(kind, null, nameThen));
	}

	private static SubjectResponse named(String kind, @Nullable String slug, String name) {
		return new SubjectResponse(kind, slug, name, null, null, null, null, null, null, List.of(), List.of(),
				List.of(), 0);
	}

}
