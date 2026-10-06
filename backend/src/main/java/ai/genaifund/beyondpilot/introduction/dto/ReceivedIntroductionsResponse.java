package ai.genaifund.beyondpilot.introduction.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "ReceivedIntroductions", description = "The requests for an introduction to the caller's organization.")
public record ReceivedIntroductionsResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Newest first.") List<IntroductionResponse> items,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether the caller answers them: an owner does, a member only reads.") boolean editable) {
}
