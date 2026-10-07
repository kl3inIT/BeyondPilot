package ai.genaifund.beyondpilot.usecase.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "UseCaseProgram", description = "A program the use case belongs to.")
public record UseCaseProgramResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The address of its public page.") String slug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether visitors see the program; a draft is for operators only.") boolean published) {
}
