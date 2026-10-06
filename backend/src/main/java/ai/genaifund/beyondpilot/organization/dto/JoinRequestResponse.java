package ai.genaifund.beyondpilot.organization.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "OrganizationJoinRequest", description = "An open request to join an organization.")
public record JoinRequestResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID organizationId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String organizationName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "company", "builder_team", "independent_builder", "other" }) String organizationType,
		@Schema(types = { "string", "null" }) @Nullable String organizationCountry,
		@Schema(types = { "string", "null" },
				description = "The organization's verified domain.") @Nullable String organizationDomain,
		@Schema(types = { "string", "null" },
				description = "The name of the person who asks; null until they have one.") @Nullable String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String email,
		@Schema(types = { "string", "null" }) @Nullable String message,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether nobody owned the organization when the person asked, so GenAI Fund decides and approval makes the person its owner.") boolean claim,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt) {
}
