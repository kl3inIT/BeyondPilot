package ai.genaifund.beyondpilot.notification;

import java.util.Map;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Operator;
import ai.genaifund.beyondpilot.notification.dto.AddEmailSuppressionRequest;
import ai.genaifund.beyondpilot.notification.dto.EmailSuppressionListRequest;
import ai.genaifund.beyondpilot.notification.dto.EmailSuppressionListResponse;
import ai.genaifund.beyondpilot.notification.dto.EmailSuppressionResponse;
import ai.genaifund.beyondpilot.notification.persistence.EmailSuppressionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The addresses BeyondPilot does not send to: those a provider reported as gone or complaining, and those an operator
 * added. An operator may let an address receive email again.
 */
@Service
public class EmailSuppressions {

	static final int PAGE_SIZE = 25;

	private static final String RESOURCE = "email_address";

	private final IdentityService identity;

	private final EmailSuppressionRepository suppressions;

	private final AuditTrail audit;

	EmailSuppressions(IdentityService identity, EmailSuppressionRepository suppressions, AuditTrail audit) {
		this.identity = identity;
		this.suppressions = suppressions;
		this.audit = audit;
	}

	/**
	 * One page of the addresses the request selects, newest first.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public EmailSuppressionListResponse list(Actor actor, EmailSuppressionListRequest request) {
		identity.requireOperator(actor);
		int page = request.page() == null ? 1 : request.page();
		return new EmailSuppressionListResponse(
				suppressions.page(request.reason(), request.q(), (page - 1) * PAGE_SIZE, PAGE_SIZE), page, PAGE_SIZE,
				suppressions.count(request.reason(), request.q()));
	}

	/**
	 * Stops email to an address.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws NotificationException when the address is already suppressed
	 */
	@Transactional
	public EmailSuppressionResponse add(Actor actor, AddEmailSuppressionRequest request) {
		Operator operator = identity.requireOperator(actor);
		if (!suppressions.add(request.address(), "manual", null, operator.accountId(), operator.label())) {
			throw new NotificationException(NotificationErrorCode.SUPPRESSION_EXISTS, "The address is already suppressed");
		}
		EmailSuppressionResponse added = suppressions.find(request.address()).orElseThrow();
		record(AuditAction.EMAIL_SUPPRESSION_ADD, operator, added.address(), Map.of());
		return added;
	}

	/**
	 * Lets email reach an address again.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws NotificationException when the address is not suppressed
	 */
	@Transactional
	public void remove(Actor actor, String address) {
		Operator operator = identity.requireOperator(actor);
		EmailSuppressionResponse suppression = suppressions.find(address)
			.orElseThrow(() -> new NotificationException(NotificationErrorCode.SUPPRESSION_NOT_FOUND,
					"The address is not suppressed"));
		suppressions.remove(address);
		record(AuditAction.EMAIL_SUPPRESSION_REMOVE, operator, suppression.address(),
				Map.of("reason", suppression.reason()));
	}

	private void record(AuditAction action, Operator operator, String address, Map<String, String> details) {
		audit.record(new AuditRecord(action,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource(RESOURCE, address, address), details));
	}

}
