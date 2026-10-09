package ai.genaifund.beyondpilot.organization.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "MergedOrganization", description = "The organization a duplicate was merged into, when and by whom.")
public record MergedOrganizationResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID intoId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String intoSlug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String intoName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant mergedAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The operator who merged it, as they are shown.") String mergedBy) {
}
