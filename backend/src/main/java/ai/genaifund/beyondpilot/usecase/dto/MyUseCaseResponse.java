package ai.genaifund.beyondpilot.usecase.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "MyUseCase", description = "One use case as a member of its organization reads and edits it.")
public record MyUseCaseResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String organizationName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "draft", "in_review", "needs_changes", "published", "closed" },
				description = "Closed once the close date has passed, whatever the use case was before.") String status,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether the members can edit it now: a draft, one GenAI Fund sent back, or one that is published.") boolean editable,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether it holds everything a use case needs to be sent for review.") boolean complete,
		@Schema(types = { "string", "null" }) @Nullable String title,
		@Schema(types = { "string", "null" }) @Nullable String problemStatement,
		@Schema(types = { "string", "null" }) @Nullable String industry,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> technologies,
		@Schema(types = { "string", "null" }) @Nullable String expectedOutcomes,
		@Schema(types = { "string", "null" }) @Nullable String currentProcess,
		@Schema(types = { "string", "null" }) @Nullable String currentSolutions,
		@Schema(types = { "string", "null" }) @Nullable String targetUsers,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<UseCaseRequirementEntry> requirements,
		@Schema(types = { "string", "null" }) @Nullable String dataReadiness,
		@Schema(types = { "string", "null" }) @Nullable String integrationRequirements,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<UseCaseAttachmentResponse> attachments,
		@Schema(types = { "integer", "null" }) @Nullable Integer budgetMin,
		@Schema(types = { "integer", "null" }) @Nullable Integer budgetMax,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean budgetToBeDetermined,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean budgetMembersOnly,
		@Schema(types = { "integer", "null" }) @Nullable Integer timelineMinWeeks,
		@Schema(types = { "integer", "null" }) @Nullable Integer timelineMaxWeeks,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean hideOrganizationName,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant closesAt,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant publishedAt,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant submittedAt,
		@Schema(description = "Who sent it for review; null if it was never sent.") @Nullable UseCasePersonResponse submittedBy,
		@Schema(types = { "string", "null" },
				description = "What GenAI Fund asked to change, when it sent the use case back.") @Nullable String reviewNote,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether the members changed it since GenAI Fund sent it back; it cannot be sent again before.") boolean changedSinceReview,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UseCasePersonResponse lastEditedBy,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long version,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant updatedAt) {
}
