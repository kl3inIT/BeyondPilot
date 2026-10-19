package ai.genaifund.beyondpilot.notification;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Operator;
import ai.genaifund.beyondpilot.notification.delivery.EmailQueued;
import ai.genaifund.beyondpilot.notification.dto.EmailMessageListRequest;
import ai.genaifund.beyondpilot.notification.dto.EmailMessageListResponse;
import ai.genaifund.beyondpilot.notification.dto.EmailMessageResponse;
import ai.genaifund.beyondpilot.notification.dto.EmailMessageSummaryResponse;
import ai.genaifund.beyondpilot.notification.dto.EmailResentResponse;
import ai.genaifund.beyondpilot.notification.dto.EmailSuppressionResponse;
import ai.genaifund.beyondpilot.notification.persistence.EmailMessageQueryRepository;
import ai.genaifund.beyondpilot.notification.persistence.EmailMessageRepository;
import ai.genaifund.beyondpilot.notification.persistence.EmailSuppressionRepository;
import ai.genaifund.beyondpilot.notification.template.EmailKind;
import org.jspecify.annotations.Nullable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The operators' reading of the email log, newest first and a page at a time, with what became of the period's email;
 * and sending one again. The log only grows, so a page is named by the message at its edge, as in the audit log.
 */
@Service
public class EmailActivity {

	static final int PAGE_SIZE = 50;

	private static final String RESOURCE = "email_message";

	private final IdentityService identity;

	private final EmailMessageQueryRepository log;

	private final EmailMessageRepository messages;

	private final EmailSuppressionRepository suppressions;

	private final ApplicationEventPublisher events;

	private final AuditTrail audit;

	EmailActivity(IdentityService identity, EmailMessageQueryRepository log, EmailMessageRepository messages,
			EmailSuppressionRepository suppressions, ApplicationEventPublisher events, AuditTrail audit) {
		this.identity = identity;
		this.log = log;
		this.messages = messages;
		this.suppressions = suppressions;
		this.events = events;
		this.audit = audit;
	}

	/**
	 * One page of the messages the request selects, and the counts of its period and kind.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public EmailMessageListResponse list(Actor actor, EmailMessageListRequest request) {
		identity.requireOperator(actor);
		String text = request.q() == null || request.q().isBlank() ? null : request.q().strip();
		int size = request.size() == null ? PAGE_SIZE : request.size();
		EmailMessageListResponse.Counts counts = log.counts(request.from(), request.kind());
		if (request.before() == null && request.after() != null) {
			Place place = Place.of(request.after());
			List<EmailMessageSummaryResponse> found = log.newer(request.from(), request.kind(), request.status(), text,
					place.at(), place.id(), size + 1);
			List<EmailMessageSummaryResponse> page = found.subList(0, Math.min(found.size(), size)).reversed();
			return new EmailMessageListResponse(page, found.size() > size ? cursor(page.getFirst()) : null,
					page.isEmpty() ? null : cursor(page.getLast()), counts);
		}
		Place place = request.before() == null ? null : Place.of(request.before());
		List<EmailMessageSummaryResponse> found = log.older(request.from(), request.kind(), request.status(), text,
				place == null ? null : place.at(), place == null ? null : place.id(), size + 1);
		List<EmailMessageSummaryResponse> page = found.subList(0, Math.min(found.size(), size));
		return new EmailMessageListResponse(page, place == null || page.isEmpty() ? null : cursor(page.getFirst()),
				found.size() > size ? cursor(page.getLast()) : null, counts);
	}

	/**
	 * One message as it was sent, with its events and whether its address is suppressed.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws NotificationException when there is no such message
	 */
	@Transactional(readOnly = true)
	public EmailMessageResponse get(Actor actor, UUID id) {
		identity.requireOperator(actor);
		EmailMessageQueryRepository.Content message = log.content(id).orElseThrow(() -> notFound(id));
		EmailSuppressionResponse suppression = suppressions.find(message.recipient()).orElse(null);
		return new EmailMessageResponse(message.id(), message.createdAt(), message.sentAt(), message.recipient(),
				message.kind(), message.subject(), message.html(), message.text(), message.status(), message.attempts(),
				message.provider(), message.providerMessageId(), message.lastError(), log.events(id), suppression,
				resendable(message, suppression));
	}

	/**
	 * {@link #list} for another module, towards the past only, a sign-in code's subject withheld.
	 * @param before the {@code older} cursor of a page, or null for the newest page
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws IllegalArgumentException when the cursor is not one this log gave
	 */
	@Transactional(readOnly = true)
	public EmailLog messages(Actor actor, @Nullable Instant from, @Nullable String kind, @Nullable String status,
			@Nullable String q, @Nullable String before, int size) {
		if (before != null && !before.matches(EmailMessageListRequest.CURSOR)) {
			throw new IllegalArgumentException("Not a cursor of the email log");
		}
		EmailMessageListResponse page = list(actor, new EmailMessageListRequest(from, kind, status, q, before, null,
				size));
		EmailMessageListResponse.Counts counts = page.counts();
		String words = q == null ? "" : q.strip().toLowerCase(Locale.ROOT);
		return new EmailLog(page.items()
			.stream()
			// A search matches a code's subject too: a code is kept only when its address matches, so searching
			// digits cannot tell a live code apart.
			.filter(message -> !signInCode(message.kind()) || words.isEmpty()
					|| message.recipient().toLowerCase(Locale.ROOT).contains(words))
			.map(message -> new EmailLog.Item(message.id(), message.createdAt(), message.recipient(), message.kind(),
					signInCode(message.kind()) ? EmailLog.SIGN_IN_CODE_SUBJECT : message.subject(), message.status(),
					message.attempts(), message.lastError()))
			.toList(), page.older(), new EmailLog.Counts(counts.total(), counts.sent(), counts.delivered(),
					counts.bounced(), counts.complained(), counts.notSent()));
	}

	/**
	 * {@link #get} for another module, a sign-in code's subject and body withheld.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws NotificationException when there is no such message
	 */
	@Transactional(readOnly = true)
	public SentEmail message(Actor actor, UUID id) {
		EmailMessageResponse message = get(actor, id);
		boolean code = signInCode(message.kind());
		EmailSuppressionResponse suppression = message.suppression();
		return new SentEmail(message.id(), message.createdAt(), message.sentAt(), message.recipient(), message.kind(),
				code ? EmailLog.SIGN_IN_CODE_SUBJECT : message.subject(), code ? null : message.html(),
				code ? null : message.text(), message.status(), message.attempts(), message.provider(),
				message.lastError(),
				message.events()
					.stream()
					.map(event -> new SentEmail.Event(event.type(), event.occurredAt(), event.detail()))
					.toList(),
				suppression == null ? null
						: new SentEmail.Suppression(suppression.reason(), suppression.createdAt(),
								suppression.createdBy()));
	}

	private static boolean signInCode(String kind) {
		return EmailKind.SIGN_IN_CODE.value().equals(kind);
	}

	/**
	 * Queues the content of a message again, as it was sent, to the same address.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws NotificationException when there is no such message, it is a sign-in code, or the address is suppressed
	 */
	@Transactional
	public EmailResentResponse resend(Actor actor, UUID id) {
		Operator operator = identity.requireOperator(actor);
		EmailMessageQueryRepository.Content message = log.content(id).orElseThrow(() -> notFound(id));
		if (EmailKind.SIGN_IN_CODE.value().equals(message.kind())) {
			throw new NotificationException(NotificationErrorCode.MESSAGE_NOT_RESENDABLE,
					"A sign-in code is not sent again from the log");
		}
		if (suppressions.isSuppressed(message.recipient())) {
			throw new NotificationException(NotificationErrorCode.ADDRESS_SUPPRESSED,
					"Message " + id + " goes to a suppressed address");
		}
		UUID again = UUID.randomUUID();
		messages.insertQueued(again, message.kind(), message.recipient(), message.subject(), message.html(),
				message.text());
		events.publishEvent(new EmailQueued(again));
		audit.record(new AuditRecord(AuditAction.EMAIL_RESEND,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource(RESOURCE, id.toString(), message.subject()), Map.of()));
		return new EmailResentResponse(again);
	}

	private static boolean resendable(EmailMessageQueryRepository.Content message,
			@Nullable EmailSuppressionResponse suppression) {
		return suppression == null && !EmailKind.SIGN_IN_CODE.value().equals(message.kind())
				&& !"queued".equals(message.status());
	}

	private static NotificationException notFound(UUID id) {
		return new NotificationException(NotificationErrorCode.MESSAGE_NOT_FOUND, "No email message " + id);
	}

	private static String cursor(EmailMessageSummaryResponse message) {
		return ChronoUnit.MICROS.between(Instant.EPOCH, message.createdAt()) + "_" + message.id();
	}

	/** Where a message stands in the order of the log. The request has already checked the cursor's form. */
	private record Place(Instant at, UUID id) {

		static Place of(String cursor) {
			int cut = cursor.indexOf('_');
			return new Place(Instant.EPOCH.plus(Long.parseLong(cursor, 0, cut, 10), ChronoUnit.MICROS),
					UUID.fromString(cursor.substring(cut + 1)));
		}

	}

}
