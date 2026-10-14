package ai.genaifund.beyondpilot.talent;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
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
import ai.genaifund.beyondpilot.notification.EmailService;
import ai.genaifund.beyondpilot.shared.Spreadsheet;
import ai.genaifund.beyondpilot.shared.SpreadsheetFile;
import ai.genaifund.beyondpilot.shared.SpreadsheetFormat;
import ai.genaifund.beyondpilot.talent.dto.AdminTalentListRequest;
import ai.genaifund.beyondpilot.talent.dto.AdminTalentListResponse;
import ai.genaifund.beyondpilot.talent.dto.AdminTalentResponse;
import ai.genaifund.beyondpilot.talent.dto.TalentDecisionRequest;
import ai.genaifund.beyondpilot.talent.dto.TalentReviewQueueResponse;
import ai.genaifund.beyondpilot.talent.dto.TalentSummaryResponse;
import ai.genaifund.beyondpilot.talent.persistence.TalentDetailRepository;
import ai.genaifund.beyondpilot.talent.persistence.TalentProfile;
import ai.genaifund.beyondpilot.talent.persistence.TalentProfileRepository;
import ai.genaifund.beyondpilot.talent.persistence.TalentQueryRepository;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What operators do with talent profiles: read those that were submitted, approve one, send one back with what to
 * change, take one down from the public and restore it, and feature one in the public directory. Every operation first checks that the caller is an operator
 * now; every decision is recorded in the audit trail in the transaction of the change, and its person is told
 * by email. A draft is its person's alone and is never shown here.
 */
@Service
public class TalentAdministration {

	private static final Logger LOG = LoggerFactory.getLogger(TalentAdministration.class);

	/** The days of a review queue are Vietnam's, as the screens show them. */
	private static final ZoneId QUEUE_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

	static final int PAGE_SIZE = 25;

	private static final String TALENT = "talent";

	private final TalentProfileRepository profiles;

	private final TalentQueryRepository profileList;

	private final TalentDetailRepository details;

	private final IdentityService identity;

	private final AuditTrail audit;

	private final EmailService email;

	private final ApplicationEventPublisher events;

	TalentAdministration(TalentProfileRepository profiles, TalentQueryRepository profileList,
			TalentDetailRepository details, IdentityService identity, AuditTrail audit, EmailService email,
			ApplicationEventPublisher events) {
		this.profiles = profiles;
		this.profileList = profileList;
		this.details = details;
		this.identity = identity;
		this.audit = audit;
		this.email = email;
		this.events = events;
	}

	/**
	 * One page of the submitted profiles the request selects, in the order it asks for; without one, those waiting
	 * for review first.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public AdminTalentListResponse list(Actor actor, AdminTalentListRequest request) {
		identity.requireOperator(actor);
		String text = TalentViews.text(request.q());
		int page = request.page() == null ? 1 : request.page();
		int size = request.size() == null ? PAGE_SIZE : request.size();
		List<TalentQueryRepository.Row> rows = profileList.adminPage(text, request.status(), request.featured(),
				request.sort(), size, (long) (page - 1) * size);
		Map<UUID, Person> people = identity
			.people(rows.stream().map(TalentQueryRepository.Row::accountId).toList());
		return new AdminTalentListResponse(rows.stream()
			.map(row -> new TalentSummaryResponse(row.id(), row.slug(), row.name(),
					email(people, row.accountId()), row.headline(), row.status(), row.suspendedAt(), row.listed(),
					row.featuredAt(), row.submittedAt(), row.updatedAt()))
			.toList(), page, size, profileList.adminCount(text, request.status(), request.featured()));
	}

	/**
	 * Talent as a spreadsheet: every page of the list as the request narrows it, in its order, for GenAI Fund to work
	 * with outside BeyondPilot. The download is recorded.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws ai.genaifund.beyondpilot.shared.SpreadsheetException when the download would hold too many rows
	 */
	@Transactional
	public SpreadsheetFile export(Actor actor, AdminTalentListRequest request, SpreadsheetFormat format) {
		Operator operator = identity.requireOperator(actor);
		List<TalentSummaryResponse> rows = Spreadsheet
			.everyPage(page -> list(actor, new AdminTalentListRequest(request.q(), request.status(), request.featured(), request.sort(),
					page, Spreadsheet.PAGE_SIZE)).items());
		Spreadsheet<TalentSummaryResponse> sheet = Spreadsheet.<TalentSummaryResponse>of("Talent")
			.text("Name", TalentSummaryResponse::name)
			.email("Email", TalentSummaryResponse::email)
			.paragraph("Headline", TalentSummaryResponse::headline)
			.group("Review")
			.label("Status", TalentSummaryResponse::status)
			.yesNo("Listed", TalentSummaryResponse::listed)
			.time("Featured since", TalentSummaryResponse::featuredAt)
			.time("Submitted at", TalentSummaryResponse::submittedAt)
			.time("Taken down at", TalentSummaryResponse::suspendedAt)
			.ungrouped()
			.time("Updated at", TalentSummaryResponse::updatedAt)
			.text("Address", TalentSummaryResponse::slug);
		SpreadsheetFile file = sheet.write(format, "talent", rows,
				Spreadsheet.About.of(operator.label(), Instant.now())
					.narrowedBy("Search", request.q())
					.narrowedBy("Status", request.status())
					.narrowedBy("Featured", request.featured())
					.narrowedBy("Order", request.sort()));
		audit.record(new AuditRecord(AuditAction.TALENT_EXPORT,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource("talent_list", "talent", "Talent"), Map.of("count", String.valueOf(file.rows()))));
		LOG.atInfo()
			.addKeyValue("event", "talent.list.exported")
			.addKeyValue("format", format.extension())
			.addKeyValue("count", file.rows())
			.log("Talent exported");
		return file;
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
				email(identity.people(List.of(profile.getAccountId())), profile.getAccountId()), profile.getFeaturedAt());
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
		if (!profile.isInReview()) {
			throw notAwaiting(profile);
		}
		profile.approve(Instant.now());
		record(AuditAction.TALENT_APPROVE, operator, profile, Map.of());
		events.publishEvent(new TalentProfileChanged(id));
		tell(profile, EmailService.TalentDecision.APPROVED, null);
	}

	/**
	 * Sends a profile that waits for review back to its person, with a reason they read. They correct it and send it
	 * again.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws TalentException when the profile does not exist or does not wait for review
	 */
	@Transactional
	public void sendBack(Actor actor, UUID id, TalentDecisionRequest request) {
		Operator operator = identity.requireOperator(actor);
		TalentProfile profile = reviewable(id);
		if (!profile.isInReview()) {
			throw notAwaiting(profile);
		}
		String message = TalentViews.text(request.message());
		profile.sendBack(request.reason(), message, Instant.now());
		record(AuditAction.TALENT_REQUEST_CHANGES, operator, profile, Map.of("reason", request.reason()));
		events.publishEvent(new TalentProfileChanged(id));
		tell(profile, EmailService.TalentDecision.CHANGES_REQUESTED, message);
	}

	/**
	 * Takes an approved profile down from the public, with a reason its person reads. Its review stays approved; they
	 * can correct it and send it again, or an operator restores it.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws TalentException when the profile does not exist, or is not approved or already taken down
	 */
	@Transactional
	public void takeDown(Actor actor, UUID id, TalentDecisionRequest request) {
		Operator operator = identity.requireOperator(actor);
		TalentProfile profile = reviewable(id);
		if (!profile.isApproved()) {
			throw new TalentException(TalentErrorCode.NOT_APPROVED,
					"Takedown of talent profile " + profile.getId() + ", which is " + profile.getStatus()
							+ (profile.isTakenDown() ? " and taken down" : ""));
		}
		String message = TalentViews.text(request.message());
		profile.takeDown(request.reason(), message, Instant.now());
		record(AuditAction.TALENT_REMOVE, operator, profile, Map.of("reason", request.reason()));
		events.publishEvent(new TalentProfileChanged(id));
		tell(profile, EmailService.TalentDecision.REMOVED, message);
	}

	/**
	 * Puts a profile taken down back in the public without a new review, and tells its person.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws TalentException when the profile does not exist, or is not an approved profile taken down
	 */
	@Transactional
	public void restore(Actor actor, UUID id) {
		Operator operator = identity.requireOperator(actor);
		TalentProfile profile = reviewable(id);
		if (!TalentProfile.APPROVED.equals(profile.getStatus()) || !profile.isTakenDown()) {
			throw new TalentException(TalentErrorCode.NOT_TAKEN_DOWN,
					"Restore of talent profile " + profile.getId() + ", which is " + profile.getStatus()
							+ (profile.isTakenDown() ? " and taken down" : ""));
		}
		profile.restore();
		record(AuditAction.TALENT_RESTORE, operator, profile, Map.of());
		events.publishEvent(new TalentProfileChanged(id));
		tell(profile, EmailService.TalentDecision.RESTORED, null);
	}

	/**
	 * Features a profile: it comes first in the opening view of the public directory, where the reader has searched
	 * for nothing, chosen no filter and reads the newest first, the earliest featured on top; its card says Featured
	 * wherever the directory shows it. Any profile that was sent for review can be featured. A profile keeps being featured through every decision, so one
	 * featured before it is public comes first from the moment it is. Featuring one that is featured already changes
	 * nothing and records nothing.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws TalentException when no submitted profile has this identifier
	 */
	@Transactional
	public void feature(Actor actor, UUID id) {
		Operator operator = identity.requireOperator(actor);
		TalentProfile profile = profiles.findById(id).filter(found -> !found.isDraft()).orElseThrow(() -> notFound(id));
		if (profiles.feature(id, Instant.now()) == 1) {
			record(AuditAction.TALENT_FEATURE, operator, profile, Map.of());
		}
	}

	/**
	 * Stops featuring a profile, which goes back to its place among the others. On one that is not featured it changes
	 * nothing and records nothing.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws TalentException when no submitted profile has this identifier
	 */
	@Transactional
	public void unfeature(Actor actor, UUID id) {
		Operator operator = identity.requireOperator(actor);
		TalentProfile profile = profiles.findById(id).filter(found -> !found.isDraft()).orElseThrow(() -> notFound(id));
		if (profiles.unfeature(id) == 1) {
			record(AuditAction.TALENT_UNFEATURE, operator, profile, Map.of());
		}
	}

	/** Tells the person what GenAI Fund decided; an account that no longer signs in is told nothing. */
	private void tell(TalentProfile profile, EmailService.TalentDecision decision, @Nullable String message) {
		Person person = identity.people(List.of(profile.getAccountId())).get(profile.getAccountId());
		if (person != null) {
			// Only a profile in the directory has a public page; any other is read by its person alone.
			@Nullable String publicSlug = profile.isApproved() && profile.isListed() ? profile.getSlug() : null;
			email.sendTalentDecision(person.email(), profile.getName(), decision, message, publicSlug);
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

	/**
	 * The talent profiles waiting for an operator's review, at most this many, for the MCP server.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public TalentAwaitingReview awaitingReview(Actor actor, int limit) {
		identity.requireOperator(actor);
		return new TalentAwaitingReview(profileList.adminCount(null, "in_review", null),
				profileList.adminPage(null, "in_review", null, null, limit, 0)
					.stream()
					.map(row -> new TalentAwaitingReview.Item(row.id(), row.name(), row.headline(), row.submittedAt()))
					.toList());
	}

	/**
	 * How many talent profiles wait for review now, since when the oldest has waited, and how many
	 * waited at the end of each of the last 14 days, for the admin home.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public TalentReviewQueueResponse queue(Actor actor) {
		identity.requireOperator(actor);
		LocalDate today = LocalDate.now(QUEUE_ZONE);
		List<Long> days = profileList.profilesWaitingByDay(today);
		return new TalentReviewQueueResponse(days.getLast(), profileList.profilesOldestWaiting(),
				today.minusDays(days.size() - 1L), days);
	}

}
