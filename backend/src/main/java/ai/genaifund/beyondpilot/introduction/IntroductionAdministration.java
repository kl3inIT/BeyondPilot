package ai.genaifund.beyondpilot.introduction;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.introduction.dto.AdminIntroductionListRequest;
import ai.genaifund.beyondpilot.introduction.dto.AdminIntroductionListResponse;
import ai.genaifund.beyondpilot.introduction.dto.AdminIntroductionResponse;
import ai.genaifund.beyondpilot.introduction.persistence.IntroductionRepository;
import ai.genaifund.beyondpilot.organization.OrganizationDirectory;
import ai.genaifund.beyondpilot.organization.OrganizationName;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What operators read of the requests for an introduction: who asked whom, about what and in which words, and which
 * ones wait too long. They read; the owners of the provider answer. No address is shown.
 */
@Service
public class IntroductionAdministration {

	static final int PAGE_SIZE = 20;

	/** How long a request may wait for an answer before operators are shown it as overdue. */
	static final Duration OVERDUE_AFTER = Duration.ofDays(3);

	private final IntroductionRepository requests;

	private final OrganizationDirectory organizations;

	private final IdentityService identity;

	IntroductionAdministration(IntroductionRepository requests, OrganizationDirectory organizations,
			IdentityService identity) {
		this.requests = requests;
		this.organizations = organizations;
		this.identity = identity;
	}

	/**
	 * One page of the requests the parameters select: those that wait first, the longest wait on top.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public AdminIntroductionListResponse list(Actor actor, AdminIntroductionListRequest request) {
		identity.requireOperator(actor);
		String text = request.q() == null || request.q().isBlank() ? null : request.q().strip();
		int page = request.page() == null ? 1 : request.page();
		Instant overdueBefore = Instant.now().minus(OVERDUE_AFTER);
		List<IntroductionRepository.Request> rows = requests.adminPage(text, request.status(), PAGE_SIZE,
				(long) (page - 1) * PAGE_SIZE);
		Map<UUID, OrganizationName> names = organizations.names(rows.stream()
			.flatMap(row -> Stream.of(row.providerOrganizationId(), row.senderOrganizationId()))
			.distinct()
			.toList());
		Map<UUID, Person> senders = identity
			.people(rows.stream().map(IntroductionRepository.Request::senderAccountId).distinct().toList());
		return new AdminIntroductionListResponse(rows.stream().map(row -> {
			Person sender = senders.get(row.senderAccountId());
			return new AdminIntroductionResponse(row.id(), row.solutionName(), name(names, row.providerOrganizationId()),
					name(names, row.senderOrganizationId()), sender == null ? null : sender.displayName(),
					row.message(), row.status(),
					IntroductionRepository.PENDING.equals(row.status()) && row.createdAt().isBefore(overdueBefore),
					row.createdAt(), row.answeredAt());
		}).toList(), page, PAGE_SIZE, requests.adminCount(text, request.status()),
				requests.pendingBefore(overdueBefore));
	}

	private static String name(Map<UUID, OrganizationName> names, UUID id) {
		OrganizationName name = names.get(id);
		return name == null ? "" : name.name();
	}
}
