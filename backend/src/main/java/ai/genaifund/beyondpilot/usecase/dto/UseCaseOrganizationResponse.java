package ai.genaifund.beyondpilot.usecase.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "UseCaseOrganization", description = "The organization a use case is for.")
public record UseCaseOrganizationResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name) {
}
