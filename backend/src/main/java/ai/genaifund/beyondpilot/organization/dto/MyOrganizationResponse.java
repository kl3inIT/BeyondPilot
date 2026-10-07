package ai.genaifund.beyondpilot.organization.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "MyOrganization", description = "Where the caller stands: the organization they belong to, or their ways in.")
public record MyOrganizationResponse(
		@Schema(types = { "object", "null" },
				description = "The organization the caller belongs to.") @Nullable OrganizationResponse organization,
		@Schema(types = { "string", "null" }, allowableValues = { "owner", "member" },
				description = "What the caller is in it.") @Nullable String role,
		@Schema(types = { "string", "null" }) @Nullable String jobTitle,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The open invitations to the caller's address.") List<InvitationResponse> invitations,
		@Schema(types = { "object", "null" },
				description = "The request the caller waits on.") @Nullable JoinRequestResponse request,
		@Schema(types = { "object", "null" },
				description = "The answer to the caller's last request, while it is a refusal and they belong nowhere and wait on nothing.") @Nullable DeclinedRequestResponse declined,
		@Schema(types = { "object", "null" },
				description = "The organization of the caller's email domain, when they belong to none.") @Nullable OrganizationMatchResponse suggestion,
		@Schema(types = { "object", "null" },
				description = "The organization GenAI Fund merged into the caller's, until they dismiss the notice.") @Nullable MergeNoticeResponse mergedFrom) {
}
