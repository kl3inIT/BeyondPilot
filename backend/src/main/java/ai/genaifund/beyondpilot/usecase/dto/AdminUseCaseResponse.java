package ai.genaifund.beyondpilot.usecase.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "AdminUseCase", description = "One use case as an operator reads it.")
public record AdminUseCaseResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UseCaseOrganizationResponse organization,
		@Schema(types = { "string", "null" }) @Nullable String title,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "draft", "in_review", "needs_changes", "approved", "closed" },
				description = "Closed once the close date has passed, whatever the use case was before.") String status,
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
		@Schema(types = { "integer", "null" }, format = "int64", description = "Whole units of currency. Null while the budget is to be determined.") @Nullable Long budgetMin,
		@Schema(types = { "integer", "null" }, format = "int64", description = "Whole units of currency. Null while the budget is to be determined.") @Nullable Long budgetMax,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "USD", "VND" },
				description = "The currency of the amounts.") String currency,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean budgetToBeDetermined,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean budgetMembersOnly,
		@Schema(types = { "integer", "null" }) @Nullable Integer timelineMinWeeks,
		@Schema(types = { "integer", "null" }) @Nullable Integer timelineMaxWeeks,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean hideOrganizationName,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant publishedAt,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant closesAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long version,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant updatedAt,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant submittedAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UseCasePersonResponse createdBy,
		@Schema(description = "Who sent it for review; null if it was never sent.") @Nullable UseCasePersonResponse submittedBy,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant reviewedAt,
		@Schema(description = "Who approved it or sent it back; null while no one has.") @Nullable UseCasePersonResponse reviewedBy,
		@Schema(types = { "string", "null" },
				description = "What GenAI Fund asked to change, while the use case is sent back.") @Nullable String reviewNote,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The programs it belongs to, by name.") List<UseCaseProgramResponse> programs) {
}
