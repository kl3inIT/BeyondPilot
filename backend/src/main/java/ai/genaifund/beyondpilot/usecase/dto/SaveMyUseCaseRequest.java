package ai.genaifund.beyondpilot.usecase.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/**
 * What a member of the organization has written so far. A draft may be saved with any part missing; only sending it
 * for review asks for all of it. Text that is empty or only blank counts as not written.
 */
@Schema(name = "SaveMyUseCase",
		description = "What the members have written of a use case so far; any part may be missing.")
public record SaveMyUseCaseRequest(@Schema(types = { "string", "null" }) @Size(max = 200) @Nullable String title,
		@Schema(types = { "string", "null" }) @Size(max = 2000) @Nullable String problemStatement,
		@Schema(types = { "string", "null" }) @Pattern(regexp = UseCaseCodes.INDUSTRY) @Nullable String industry,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Size(
				max = 11) List<@NotNull @Pattern(regexp = UseCaseCodes.TECHNOLOGY) String> technologies,
		@Schema(types = { "string", "null" }) @Size(max = 2000) @Nullable String expectedOutcomes,
		@Schema(types = { "string", "null" }) @Size(max = 2000) @Nullable String currentProcess,
		@Schema(types = { "string", "null" }) @Size(max = 2000) @Nullable String currentSolutions,
		@Schema(types = { "string", "null" }) @Size(max = 2000) @Nullable String targetUsers,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "What the solution must do, in the order written.") @NotNull @Size(
						max = 30) List<@NotNull @Valid UseCaseRequirementEntry> requirements,
		@Schema(types = { "string", "null" }) @Size(max = 2000) @Nullable String dataReadiness,
		@Schema(types = { "string", "null" }) @Size(max = 2000) @Nullable String integrationRequirements,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Files the caller uploaded for a use case, in the order shown.") @NotNull @Size(
						max = 10) List<@NotNull UUID> attachmentFileIds,
		@Schema(types = { "integer", "null" }, description = "US dollars. Null while the budget is to be determined.") @Min(0) @Max(
				100_000_000) @Nullable Integer budgetMin,
		@Schema(types = { "integer", "null" }, description = "US dollars. Null while the budget is to be determined.") @Min(0) @Max(
				100_000_000) @Nullable Integer budgetMax,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean budgetToBeDetermined,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Only signed-in members see the amount.") boolean budgetMembersOnly,
		@Schema(types = { "integer", "null" }) @Min(1) @Max(260) @Nullable Integer timelineMinWeeks,
		@Schema(types = { "integer", "null" }) @Min(1) @Max(260) @Nullable Integer timelineMaxWeeks,
		@Schema(types = { "string", "null" }, format = "date-time",
				description = "When proposals stop. It must be in the future.") @Nullable Instant closesAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean hideOrganizationName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The version the caller read; a save over a newer one is refused.") @NotNull Long version) {
}
