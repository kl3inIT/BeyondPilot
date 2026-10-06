package ai.genaifund.beyondpilot.talent;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Operator;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.talent.dto.AdminTalentListRequest;
import ai.genaifund.beyondpilot.talent.dto.AdminTalentListResponse;
import ai.genaifund.beyondpilot.talent.dto.AdminTalentResponse;
import ai.genaifund.beyondpilot.talent.dto.RejectTalentRequest;
import ai.genaifund.beyondpilot.talent.dto.TalentSummaryResponse;
import ai.genaifund.beyondpilot.talent.persistence.TalentDetailRepository;
import ai.genaifund.beyondpilot.talent.persistence.TalentProfile;
import ai.genaifund.beyondpilot.talent.persistence.TalentProfileRepository;
import ai.genaifund.beyondpilot.talent.persistence.TalentQueryRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What operators do with talent profiles: read those that were submitted, approve one, reject one with a reason. Every
 * operation first checks that the caller is an operator now, and every decision is recorded in the audit trail in its
 * own transaction. A draft is its person's alone and is never shown here.
 */
@Service
public class TalentAdministration {

	static final int PAGE_SIZE = 25;

	private static final String TALENT = "talent";

	private final TalentProfileRepository profiles;

	private final TalentQueryRepository profileList;

	private final TalentDetailRepository details;

	private final IdentityService identity;

	private final AuditTrail audit;

	private final ApplicationEventPublisher events;

	TalentAdministration(TalentProfileRepository profiles, TalentQueryRepository profileList,
			TalentDetailRepository details, IdentityService identity, AuditTrail audit,
			ApplicationEventPublisher events) {
		this.profiles = profiles;
		this.profileList = profileList;
		this.details = details;
		this.identity = identity;
		this.audit = audit;
		this.events = events;
	}

	/**
	 * One page of the submitted profiles the request selects: those waiting for review first.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public AdminTalentListResponse list(Actor actor, AdminTalentListRequest request) {
		identity.requireOperator(actor);
		String text = TalentViews.text(request.q());
		int page = request.page() == null ? 1 : request.page();
		List<TalentQueryRepository.Row> rows = profileList.adminPage(text, request.status(), PAGE_SIZE,
				(long) (page - 1) * PAGE_SIZE);
		Map<UUID, Person> people = identity
			.people(rows.stream().map(TalentQueryRepository.Row::accountId).toList());
		return new AdminTalentListResponse(rows.stream()
			.map(row -> new TalentSummaryResponse(row.id(), row.slug(), row.name(),
					email(people, row.accountId()), row.headline(), row.status(), row.listed(), row.submittedAt(),
					row.updatedAt()))
			.toList(), page, PAGE_SIZE, profileList.adminCount(text, request.status()));
	}

	/**
	 * One submitted profile as an operator reviews it.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws TalentException when no submitted profile has this identifier
	 */
	@Transactional(readOnly = true)
	public AdminTalentResponse get(Actor actor, UUID id) {
		identity.requireOperator(actor);
		TalentProfile profile = profiles.findById(id).filter(found -> !found.isDraft()).orElseThrow(() -> notFound(id));
		return new AdminTalentResponse(TalentViews.profile(profile, details.projects(id)),
				email(identity.people(List.of(profile.getAccountId())), profile.getAccountId()));
	}

	/**
	 * Approves a profile that waits for review, which puts it in the public directory unless its person keeps it
	 * unlisted.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws TalentException when the profile does not exist or does not wait for review
	 */
	@Transactional
	public void approve(Actor actor, UUID id) {
		Operator operator = identity.requireOperator(actor);
		TalentProfile profile = reviewable(id);
		if (!profile.isSubmitted()) {
			throw notAwaiting(profile);
		}
		profile.approve(Instant.now());
		record(AuditAction.TALENT_APPROVE, operator, profile, Map.of());
		events.publishEvent(new TalentProfileChanged(id));
	}

	/**
	 * Rejects a profile that waits for review, or takes an approved one out of the directory, with a reason its person
	 * reads.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws TalentException when the profile does not exist, or is neither waiting for review nor approved
	 */
	@Transactional
	public void reject(Actor actor, UUID id, RejectTalentRequest request) {
		Operator operator = identity.requireOperator(actor);
		TalentProfile profile = reviewable(id);
		if (!profile.isSubmitted() && !profile.isApproved()) {
			throw notAwaiting(profile);
		}
		profile.reject(request.reason(), TalentViews.text(request.message()), Instant.now());
		record(AuditAction.TALENT_REJECT, operator, profile, Map.of("reason", request.reason()));
		events.publishEvent(new TalentProfileChanged(id));
	}

	private TalentProfile reviewable(UUID id) {
		return profiles.findForUpdate(id).filter(found -> !found.isDraft()).orElseThrow(() -> notFound(id));
	}

	private void record(AuditAction action, Operator operator, TalentProfile profile, Map<String, String> details) {
		audit.record(new AuditRecord(action,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource(TALENT, profile.getId().toString(), profile.getName()), details));
	}

	private static String email(Map<UUID, Person> people, UUID accountId) {
		Person person = people.get(accountId);
		return person == null ? "" : person.email();
	}

	private static TalentException notFound(UUID id) {
		return new TalentException(TalentErrorCode.PROFILE_NOT_FOUND, "No submitted talent profile " + id);
	}

	private static TalentException notAwaiting(TalentProfile profile) {
		return new TalentException(TalentErrorCode.NOT_AWAITING_REVIEW,
				"Decision on talent profile " + profile.getId() + ", which is " + profile.getStatus());
	}
}
