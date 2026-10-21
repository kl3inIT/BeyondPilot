package ai.genaifund.beyondpilot.mcp.server;

import java.util.List;
import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.organization.OrganizationAdministration;
import ai.genaifund.beyondpilot.organization.OrganizationReviewRecord;
import org.springframework.stereotype.Component;

/**
 * Who a decision emails, as a write tool's answer says it: every member of the organization for a decision on its
 * solution or use case. An organization nobody has joined yet tells nobody, and the answer says so rather than
 * promise an email.
 */
@Component
class Recipients {

	private final OrganizationAdministration organizations;

	Recipients(OrganizationAdministration organizations) {
		this.organizations = organizations;
	}

	/** Every member of the organization, whom a decision on its solution or use case emails. */
	String members(Actor actor, UUID organizationId) {
		OrganizationReviewRecord organization = organizations.reviewRecord(actor, organizationId);
		List<OrganizationReviewRecord.Member> members = organization.members();
		return said(members.size(), organization.name());
	}

	private static String said(long count, String organization) {
		if (count == 0) {
			return "Nobody: " + organization + " has no member yet.";
		}
		return count + " member" + (count == 1 ? "" : "s") + " of " + organization + ", by email.";
	}

}
