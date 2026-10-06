package ai.genaifund.beyondpilot.usecase.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "MyUseCases",
		description = "The use cases of the caller's organization, the most recently touched first.")
public record MyUseCasesResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<MyUseCaseSummaryResponse> items) {
}
