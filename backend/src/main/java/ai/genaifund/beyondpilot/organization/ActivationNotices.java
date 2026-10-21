package ai.genaifund.beyondpilot.organization;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.notification.EmailService;
import ai.genaifund.beyondpilot.organization.persistence.MembershipRepository;
import ai.genaifund.beyondpilot.organization.persistence.Organization;
import ai.genaifund.beyondpilot.organization.persistence.OrganizationQueryRepository;
import ai.genaifund.beyondpilot.organization.persistence.OrganizationRepository;

/**
 * Tells the owners of the organizations that GenAI Fund's review used to hold that theirs is active. V109 marks those
 * organizations; after the application starts, a background thread takes the marked ones in batches. Each batch locks
 * its rows, queues one email per owner and clears the marks in a single transaction, so a failed batch keeps its marks
 * and is tried again at the next start, and a second instance skips the rows this one holds. An organization taken down
 * or merged since the mark is cleared without an email.
 */
@Component
class ActivationNotices {

	private static final Logger LOG = LoggerFactory.getLogger(ActivationNotices.class);

	private static final int BATCH_SIZE = 100;

	private final OrganizationQueryRepository organizationList;

	private final OrganizationRepository organizations;

	private final MembershipRepository memberships;

	private final IdentityService identity;

	private final EmailService email;

	private final TransactionTemplate transaction;

	ActivationNotices(OrganizationQueryRepository organizationList, OrganizationRepository organizations,
			MembershipRepository memberships, IdentityService identity, EmailService email,
			TransactionTemplate transaction) {
		this.organizationList = organizationList;
		this.organizations = organizations;
		this.memberships = memberships;
		this.identity = identity;
		this.email = email;
		this.transaction = transaction;
	}

	/** Sends in the background, so that a deployment does not wait for the emails to be queued. */
	@EventListener(ApplicationReadyEvent.class)
	void sendInBackground() {
		Thread.ofVirtual().name("organization-activation-notices").start(this::sendAll);
	}

	/** Sends batch after batch until none is left for this caller; a failure is logged and leaves its batch marked. */
	void sendAll() {
		int organizationsTaken = 0;
		int emailsQueued = 0;
		try {
			Batch batch;
			do {
				batch = sendBatch();
				organizationsTaken += batch.organizations();
				emailsQueued += batch.emails();
			}
			while (batch.organizations() > 0);
		}
		catch (RuntimeException failure) {
			LOG.atError()
				.addKeyValue("event", "organization.activation.failed")
				.addKeyValue("error_type", failure.getClass().getName())
				.addKeyValue("error_code", "ACTIVATION_NOTICE_FAILED")
				.log("The organizations still marked will be told at the next start");
		}
		if (organizationsTaken > 0) {
			LOG.atInfo()
				.addKeyValue("event", "organization.activation.notified")
				.addKeyValue("organizations", organizationsTaken)
				.addKeyValue("emails", emailsQueued)
				.log("Organizations told they are active");
		}
	}

	/** One batch in one transaction: the lock, the emails and the cleared marks stand or fall together. */
	Batch sendBatch() {
		return transaction.execute(status -> {
			List<UUID> ids = organizationList.lockMarked(BATCH_SIZE);
			int emails = 0;
			for (Organization organization : organizations.findAllById(ids)) {
				if (organization.isApproved()) {
					emails += tellOwners(organization);
				}
			}
			organizationList.clearMarks(ids);
			return new Batch(ids.size(), emails);
		});
	}

	private int tellOwners(Organization organization) {
		List<UUID> owners = memberships.members(organization.getId())
			.stream()
			.filter(MembershipRepository.Member::isOwner)
			.map(MembershipRepository.Member::accountId)
			.toList();
		Collection<Person> people = identity.people(owners).values();
		for (Person owner : people) {
			email.sendOrganizationActivated(owner.email(), organization.getName());
		}
		return people.size();
	}

	/** What a batch took: the marked organizations and the emails queued for their owners. */
	record Batch(int organizations, int emails) {
	}

}
