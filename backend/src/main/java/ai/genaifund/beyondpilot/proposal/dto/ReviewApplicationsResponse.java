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
					description = "The applicant's email, which the list's search matches; null for a judge, who reads no contact details.") @Nullable String email,
			@Schema(types = { "string", "null" },
					description = "The answer to the program's first one-choice question.") @Nullable String choice,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant submittedAt,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "The number of the version under review.") int version,
			@Schema(types = { "string", "null" }, allowableValues = { "under_review", "shortlisted", "not_selected" },
					description = "GenAI Fund's decision; null for a judge.") @Nullable String reviewStatus,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Whether GenAI Fund shortlisted it, the one part of the decision a judge reads.") boolean shortlisted,
			@Schema(types = { "number", "null" },
					description = "For an operator the mean of every judge's score; for a judge their own. In points when the criteria have points, otherwise from 1 to 10.") @Nullable Double average,
			@Schema(types = { "integer", "null" },
					description = "How many scored it; null for a judge.") @Nullable Integer scored,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "none", "noted", "scored" },
					description = "What the caller did with it: noted is a note or a bookmark without scores.") String mine,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Whether the caller bookmarked it.") boolean bookmarked,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "The caller's own application, or their organization's, which they never score or decide.") boolean own) {
	}
}
