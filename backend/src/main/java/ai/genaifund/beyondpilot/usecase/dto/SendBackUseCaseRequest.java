package ai.genaifund.beyondpilot.usecase.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(name = "SendBackUseCase", description = "Why GenAI Fund sends a use case back to its organization.")
public record SendBackUseCaseRequest(@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
		description = "What the organization should change. Its members read it and receive it by email.") @NotBlank @Size(
				max = 1000) String reason) {
}
