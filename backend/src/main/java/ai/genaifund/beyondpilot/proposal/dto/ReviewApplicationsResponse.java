package ai.genaifund.beyondpilot.proposal.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ReviewApplications",
		description = "A program's submitted applications as the caller reviews them, the earliest submitted first.")
public record ReviewApplicationsResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) ReviewHeadResponse head,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<Item> items,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Applications started and never submitted.") long drafts,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Applications withdrawn by their applicant.") long withdrawn) {

	@Schema(name = "ReviewApplicationItem")
	public record Item(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String solutionName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String organizationName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "The organization's type, such as independent_builder, builder_team or company.") String organizationType,
			@Schema(types = { "string", "null" }) @Nullable String country,
			@Schema(types = { "string", "null" },
					description = "The answer to the program's first one-choice question.") @Nullable String choice,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant submittedAt,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "The number of the version under review.") int version,
			@Schema(types = { "string", "null" }, allowableValues = { "under_review", "shortlisted", "not_selected" },
					description = "GenAI Fund's decision; null for a judge.") @Nullable String reviewStatus,
			@Schema(types = { "number", "null" },
					description = "For an operator the mean of every judge's score; for a judge their own.") @Nullable Double average,
			@Schema(types = { "integer", "null" },
					description = "How many scored it; null for a judge.") @Nullable Integer scored,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "none", "scored", "conflict" },
					description = "What the caller did with it.") String mine) {
	}
}
