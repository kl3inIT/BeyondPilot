package ai.genaifund.beyondpilot.mcp.server;

import java.util.List;
import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.organization.OrganizationAdministration;
import ai.genaifund.beyondpilot.organization.OrganizationReviewRecord;
import org.springframework.stereotype.Component;

/**
 * Who a decision emails, as a write tool's answer says it: the owners of an organization for a decision on it, every
 * member for one on its solution or use case. An organization nobody has joined yet tells nobody, and the answer says
 * so rather than promise an email.
 */
@Component
class Recipients {

	private final OrganizationAdministration organizations;

	Recipients(OrganizationAdministration organizations) {
		this.organizations = organizations;
	}

	/** The owners of the organization, whom a decision on it emails. */
	String owners(Actor actor, UUID organizationId) {
		OrganizationReviewRecord organization = organizations.reviewRecord(actor, organizationId);
		long owners = organization.members().stream().filter(member -> "owner".equals(member.role())).count();
		return said(owners, "owner", organization.name());
	}

	/** Every member of the organization, whom a decision on its solution or use case emails. */
	String members(Actor actor, UUID organizationId) {
		OrganizationReviewRecord organization = organizations.reviewRecord(actor, organizationId);
		List<OrganizationReviewRecord.Member> members = organization.members();
		return said(members.size(), "member", organization.name());
	}

	private static String said(long count, String role, String organization) {
		if (count == 0) {
			return "Nobody: " + organization + " has no " + role + " yet.";
		}
		return count + " " + role + (count == 1 ? "" : "s") + " of " + organization + ", by email.";
	}

}
