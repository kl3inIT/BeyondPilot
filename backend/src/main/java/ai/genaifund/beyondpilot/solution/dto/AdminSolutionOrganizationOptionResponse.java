package ai.genaifund.beyondpilot.solution.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

/** One organization in the operators' solution filter. */
@Schema(name = "AdminSolutionOrganizationOption")
public record AdminSolutionOrganizationOptionResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name) {
}
