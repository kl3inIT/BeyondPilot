package ai.genaifund.beyondpilot.proposal.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ApplicationView",
		description = "Everything the application form of a program needs for the signed-in person.")
public record ApplicationViewResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) ProgramFormResponse program,
		@Schema(types = { "object", "null" },
				description = "The person's application; null until they first save.") @Nullable ApplicationResponse application,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The address the person signs in with.") String email,
		@Schema(types = { "object", "null" },
				description = "What the person's latest other application held, for a new one to start from; null once this one exists.") @Nullable ApplicationMaterialsResponse previous,
		@Schema(types = { "object", "null" },
				description = "The organization the person belongs to; null when they belong to none.") @Nullable ApplyingOrganizationResponse organization,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<SolutionOptionResponse> solutions) {
}
