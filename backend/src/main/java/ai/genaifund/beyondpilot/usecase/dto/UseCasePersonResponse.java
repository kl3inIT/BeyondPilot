package ai.genaifund.beyondpilot.usecase.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "UseCasePerson", description = "Who last changed a use case, as the reader may be shown them.")
public record UseCasePersonResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Their name, or their address until they have a name.") String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Whether it is the caller.") boolean you,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether the person works for GenAI Fund rather than for the organization.") boolean genaiFund) {
}
