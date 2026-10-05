package ai.genaifund.beyondpilot.organization;

import ai.genaifund.beyondpilot.ErrorCategory;
import ai.genaifund.beyondpilot.ErrorCode;

public enum OrganizationErrorCode implements ErrorCode {

	ORGANIZATION_NOT_FOUND("ORGANIZATION_NOT_FOUND", ErrorCategory.NOT_FOUND, "There is no such organization."),

	MEMBERSHIP_REQUIRED("ORGANIZATION_MEMBERSHIP_REQUIRED", ErrorCategory.NOT_PERMITTED,
			"This needs an organization you belong to."),

	OWNER_REQUIRED("ORGANIZATION_OWNER_REQUIRED", ErrorCategory.NOT_PERMITTED,
			"Only an owner of the organization can do this."),

	ALREADY_MEMBER("ORGANIZATION_ALREADY_MEMBER", ErrorCategory.CONFLICT,
			"You already belong to an organization. A person belongs to one at a time."),

	REQUEST_PENDING("ORGANIZATION_REQUEST_PENDING", ErrorCategory.CONFLICT,
			"You are already waiting on a request. Withdraw it before asking again."),

	INVITATION_NOT_FOUND("ORGANIZATION_INVITATION_NOT_FOUND", ErrorCategory.NOT_FOUND,
			"This invitation is no longer open."),

	REQUEST_NOT_FOUND("ORGANIZATION_REQUEST_NOT_FOUND", ErrorCategory.NOT_FOUND, "This request is no longer open."),

	MEMBER_NOT_FOUND("ORGANIZATION_MEMBER_NOT_FOUND", ErrorCategory.NOT_FOUND,
			"This person does not belong to the organization."),

	ALREADY_INVITED("ORGANIZATION_ALREADY_INVITED", ErrorCategory.CONFLICT,
			"This address already holds an open invitation."),

	INVITEE_IS_MEMBER("ORGANIZATION_INVITEE_IS_MEMBER", ErrorCategory.CONFLICT,
			"This person already belongs to the organization."),

	LAST_OWNER("ORGANIZATION_LAST_OWNER", ErrorCategory.CONFLICT,
			"An organization keeps at least one owner. Make someone else an owner first."),

	CHANGED_MEANWHILE("ORGANIZATION_CHANGED_MEANWHILE", ErrorCategory.CONFLICT,
			"Someone else saved this organization in the meantime. Reload it and make your changes again."),

	NOT_AWAITING_REVIEW("ORGANIZATION_NOT_AWAITING_REVIEW", ErrorCategory.CONFLICT,
			"This organization is not waiting for review."),

	DOMAIN_TAKEN("ORGANIZATION_DOMAIN_TAKEN", ErrorCategory.CONFLICT,
			"Another organization already has this email domain.");

	private final String code;
	private final ErrorCategory category;
	private final String message;

	OrganizationErrorCode(String code, ErrorCategory category, String message) {
		this.code = code;
		this.category = category;
		this.message = message;
	}

	@Override
	public String code() {
		return code;
	}

	@Override
	public ErrorCategory category() {
		return category;
	}

	@Override
	public String message() {
		return message;
	}
}
