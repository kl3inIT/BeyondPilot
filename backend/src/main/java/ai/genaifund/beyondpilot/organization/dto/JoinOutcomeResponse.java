package ai.genaifund.beyondpilot.organization.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "JoinOutcome", description = "What asking to get into an organization did.")
public record JoinOutcomeResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "joined", "owner", "requested" },
				description = """
						`joined`: the caller is a member. `owner`: nobody owned it and the caller's address is on \
						its domain, so they own it. `requested`: its owners, or GenAI Fund when nobody owns it, \
						decide.""") String outcome) {
}
