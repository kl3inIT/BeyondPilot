package ai.genaifund.beyondpilot.organization;

import java.util.List;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.notification.EmailService;
import ai.genaifund.beyondpilot.organization.persistence.MembershipRepository;
import ai.genaifund.beyondpilot.organization.persistence.Organization;
import ai.genaifund.beyondpilot.organization.persistence.OrganizationQueryRepository;
import ai.genaifund.beyondpilot.organization.persistence.OrganizationRepository;

/**
 * Tells the owners of the organizations that GenAI Fund's review used to hold that theirs is active. V109 marks those
 * organizations; the application sends one email per owner after it starts and clears the mark in the same
 * transaction, so a restart or a second instance sends nothing twice. An organization taken down or merged since the
 * mark is cleared without an email.
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

	ActivationNotices(OrganizationQueryRepository organizationList, OrganizationRepository organizations,
			MembershipRepository memberships, IdentityService identity, EmailService email) {
		this.organizationList = organizationList;
		this.organizations = organizations;
		this.memberships = memberships;
		this.identity = identity;
		this.email = email;
	}

	@EventListener(ApplicationReadyEvent.class)
	void sendAll() {
		int notified = 0;
		int batch;
		do {
			batch = sendBatch();
			notified += batch;
		}
		while (batch > 0);
		if (notified > 0) {
			LOG.atInfo()
				.addKeyValue("event", "organization.activation.notified")
				.addKeyValue("count", notified)
				.log("Organizations told they are active");
		}
	}

	/**
	 * Takes one batch of marked organizations, emails the owners of those still active and clears the marks.
	 * @return how many marked organizations the batch took; 0 when none is left for this caller
	 */
	@Transactional
	int sendBatch() {
		List<UUID> ids = organizationList.lockMarked(BATCH_SIZE);
		for (Organization organization : organizations.findAllById(ids)) {
			if (organization.isApproved()) {
				tellOwners(organization);
			}
		}
		organizationList.clearMarks(ids);
		return ids.size();
	}

	private void tellOwners(Organization organization) {
		List<UUID> owners = memberships.members(organization.getId())
			.stream()
			.filter(MembershipRepository.Member::isOwner)
			.map(MembershipRepository.Member::accountId)
			.toList();
		for (Person owner : identity.people(owners).values()) {
			email.sendOrganizationActivated(owner.email(), organization.getName());
		}
	}

}
