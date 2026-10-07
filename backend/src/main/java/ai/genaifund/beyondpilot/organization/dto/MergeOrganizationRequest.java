package ai.genaifund.beyondpilot.organization.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(name = "MergeOrganization", description = "The organization a duplicate is merged into.")
public record MergeOrganizationRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The organization kept; it receives the duplicate's people and records.") @NotNull UUID intoId) {
}
