package ai.genaifund.beyondpilot.organization.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "DeclinedOrganizationRequest",
		description = "The answer to the caller's last request to get into an organization, when it was declined.")
public record DeclinedRequestResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID organizationId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String organizationName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "company", "builder_team", "independent_builder", "other" }) String organizationType,
		@Schema(types = { "string", "null" }) @Nullable String organizationCountry,
		@Schema(types = { "string", "null" },
				description = "The organization's verified domain.") @Nullable String organizationDomain,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether it was a claim, which GenAI Fund declined; otherwise an owner did.") boolean claim,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant decidedAt) {
}
