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
import ai.genaifund.beyondpilot.notification.EmailService;
import ai.genaifund.beyondpilot.talent.dto.AdminTalentEnquiryListRequest;
import ai.genaifund.beyondpilot.talent.dto.AdminTalentEnquiryListResponse;
import ai.genaifund.beyondpilot.talent.dto.AdminTalentEnquiryResponse;
import ai.genaifund.beyondpilot.talent.dto.TalentDecisionRequest;
import ai.genaifund.beyondpilot.talent.dto.TalentSummaryResponse;
import ai.genaifund.beyondpilot.talent.persistence.TalentDetailRepository;
import ai.genaifund.beyondpilot.talent.persistence.TalentProfile;
import ai.genaifund.beyondpilot.talent.persistence.TalentProfileRepository;
import ai.genaifund.beyondpilot.talent.persistence.TalentQueryRepository;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What operators do with talent profiles: read those that were submitted, approve one, ask for changes to one, remove
 * one from the public, and read the messages people reported. Every operation first checks that the caller is an
 * operator now; every decision is recorded in the audit trail in the transaction of the change, and its person is told
 * by email. A draft is its person's alone and is never shown here.
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

	private final EmailService email;

	TalentAdministration(TalentProfileRepository profiles, TalentQueryRepository profileList,
			TalentDetailRepository details, IdentityService identity, AuditTrail audit, EmailService email) {
		this.profiles = profiles;
		this.profileList = profileList;
		this.details = details;
		this.identity = identity;
		this.audit = audit;
		this.email = email;
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
		tell(profile, EmailService.TalentDecision.APPROVED, null);
	}

	/**
	 * Asks the person to change a profile that waits for review, with a reason they read. They correct it and send it
	 * again.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws TalentException when the profile does not exist or does not wait for review
	 */
	@Transactional
	public void requestChanges(Actor actor, UUID id, TalentDecisionRequest request) {
		Operator operator = identity.requireOperator(actor);
		TalentProfile profile = reviewable(id);
		if (!profile.isSubmitted()) {
			throw notAwaiting(profile);
		}
		String message = TalentViews.text(request.message());
		profile.requestChanges(request.reason(), message, Instant.now());
		record(AuditAction.TALENT_REQUEST_CHANGES, operator, profile, Map.of("reason", request.reason()));
		tell(profile, EmailService.TalentDecision.CHANGES_REQUESTED, message);
	}

	/**
	 * Removes an approved profile from the public, with a reason its person reads. They can correct it and send it
	 * again.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws TalentException when the profile does not exist or is not approved
	 */
	@Transactional
	public void remove(Actor actor, UUID id, TalentDecisionRequest request) {
		Operator operator = identity.requireOperator(actor);
		TalentProfile profile = reviewable(id);
		if (!profile.isApproved()) {
			throw new TalentException(TalentErrorCode.NOT_APPROVED,
					"Removal of talent profile " + profile.getId() + ", which is " + profile.getStatus());
		}
		String message = TalentViews.text(request.message());
		profile.remove(request.reason(), message, Instant.now());
		record(AuditAction.TALENT_REMOVE, operator, profile, Map.of("reason", request.reason()));
		tell(profile, EmailService.TalentDecision.REMOVED, message);
	}

	/**
	 * One page of the messages people reported as unwanted, the newest first, with who sent them and to whom.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public AdminTalentEnquiryListResponse reported(Actor actor, AdminTalentEnquiryListRequest request) {
		identity.requireOperator(actor);
		int page = request.page() == null ? 1 : request.page();
		List<TalentDetailRepository.ReportedEnquiry> rows = details.reported(PAGE_SIZE, (long) (page - 1) * PAGE_SIZE);
		Map<UUID, Person> senders = identity
			.people(rows.stream().map(TalentDetailRepository.ReportedEnquiry::senderAccountId).distinct().toList());
		return new AdminTalentEnquiryListResponse(rows.stream().map(row -> {
			Person sender = senders.get(row.senderAccountId());
			return new AdminTalentEnquiryResponse(row.id(), row.profileId(), row.profileName(),
					sender == null ? null : sender.displayName(), email(senders, row.senderAccountId()), row.topic(),
					row.message(), row.createdAt(), row.answeredAt());
		}).toList(), page, PAGE_SIZE, details.reportedCount());
	}

	/** Tells the person what GenAI Fund decided; an account that no longer signs in is told nothing. */
	private void tell(TalentProfile profile, EmailService.TalentDecision decision, @Nullable String message) {
		Person person = identity.people(List.of(profile.getAccountId())).get(profile.getAccountId());
		if (person != null) {
			email.sendTalentDecision(person.email(), profile.getName(), decision, message);
		}
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
