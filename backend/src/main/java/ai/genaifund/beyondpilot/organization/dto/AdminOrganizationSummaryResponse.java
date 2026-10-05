package ai.genaifund.beyondpilot.organization.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "AdminOrganizationSummary", description = "One organization in the operators' list.")
public record AdminOrganizationSummaryResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String slug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> roles,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "company", "builder_team", "independent_builder", "other" }) String type,
		@Schema(types = { "string", "null" }) @Nullable String country,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "pending", "approved", "rejected" }) String status,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int members,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether a person owns it; an operator-created organization has no owner until someone accepts or claims it.") boolean owned,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many people ask to own it; always 0 for an owned organization.") int openClaims,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt) {
}
