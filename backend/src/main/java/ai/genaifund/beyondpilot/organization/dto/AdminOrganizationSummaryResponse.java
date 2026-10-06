package ai.genaifund.beyondpilot.organization.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "AdminOrganizationSummary", description = "One organization in the operators' list.")
public record AdminOrganizationSummaryResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String slug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "company", "builder_team", "independent_builder", "other" }) String type,
		@Schema(types = { "string", "null" }) @Nullable String country,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "pending", "approved", "rejected" }) String status,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int members,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether a person owns it; an operator-created organization has no owner until someone accepts or claims it.") boolean owned,
		@Schema(types = { "string", "null" }, allowableValues = { "new", "claim" },
				description = "What waits for an operator: `new` for an organization to review, `claim` for a request to own one; null when nothing does.") @Nullable String request,
		@Schema(types = { "string", "null" },
				description = "The oldest open claim, which the list decides first; null without one.") @Nullable UUID claimId,
		@Schema(types = { "string", "null" },
				description = "Who asked for what waits, as they are shown.") @Nullable String askedBy,
		@Schema(types = { "string", "null" }, description = "When they asked.") @Nullable Instant requestedAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt) {
}
