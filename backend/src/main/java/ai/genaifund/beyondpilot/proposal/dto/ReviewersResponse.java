package ai.genaifund.beyondpilot.proposal.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "Reviewers", description = "The people who score a program's applications, with their progress.")
public record ReviewersResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<ReviewerResponse> items,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many submitted applications there are to score.") long applications) {
}
