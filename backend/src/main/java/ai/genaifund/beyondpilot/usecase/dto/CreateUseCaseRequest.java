package ai.genaifund.beyondpilot.usecase.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "CreateUseCase", description = """
		A use case an operator writes for an organization. It is saved as a draft the organization's members can edit, or \
		published at once when publishNow is true. Its title, problem, industry, expected outcomes and budget are \
		required; the rest may be left out when the brief does not say.""")
public record CreateUseCaseRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "An approved organization.") @NotNull UUID organizationId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 200) String title,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 2000) String problemStatement,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Pattern(
				regexp = UseCaseCodes.INDUSTRY) String industry,
		@Schema(types = { "array", "null" },
				description = "None when the brief names none.") @Size(
						max = 11) @Nullable List<@NotNull @Pattern(regexp = UseCaseCodes.TECHNOLOGY) String> technologies,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 2000) String expectedOutcomes,
		@Schema(types = { "string", "null" }) @Size(max = 2000) @Nullable String currentProcess,
		@Schema(types = { "string", "null" }) @Size(max = 2000) @Nullable String currentSolutions,
		@Schema(types = { "string", "null" }) @Size(max = 2000) @Nullable String targetUsers,
		@Schema(types = { "array", "null" },
				description = "What the solution must do, in the order written; none when the brief lists none.") @Size(
						max = 30) @Nullable List<@NotNull @Valid UseCaseRequirementEntry> requirements,
		@Schema(types = { "string", "null" }) @Size(max = 2000) @Nullable String dataReadiness,
		@Schema(types = { "string", "null" }) @Size(max = 2000) @Nullable String integrationRequirements,
		@Schema(types = { "array", "null" },
				description = "Files the caller uploaded for a use case, in the order shown; none when absent.") @Size(
						max = 10) @Nullable List<@NotNull UUID> attachmentFileIds,
		@Schema(types = { "string", "null" }, allowableValues = { "USD", "VND" },
				description = "The currency of the budget; USD when absent.") @Pattern(
						regexp = UseCaseCodes.CURRENCY) @Nullable String currency,
		@Schema(types = { "integer", "null" }, format = "int64",
				description = "Whole units of currency. Null while the budget is to be determined.") @Min(0) @Max(
				1_000_000_000_000L) @Nullable Long budgetMin,
		@Schema(types = { "integer", "null" }, format = "int64",
				description = "Whole units of currency. Null while the budget is to be determined.") @Min(0) @Max(
				1_000_000_000_000L) @Nullable Long budgetMax,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean budgetToBeDetermined,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Only signed-in members see the amount.") boolean budgetMembersOnly,
		@Schema(types = { "integer", "null" }, description = "Null with timelineMaxWeeks when not known.") @Min(1) @Max(
				260) @Nullable Integer timelineMinWeeks,
		@Schema(types = { "integer", "null" }, description = "Null with timelineMinWeeks when not known.") @Min(1) @Max(
				260) @Nullable Integer timelineMaxWeeks,
		@Schema(types = { "string", "null" }, format = "date-time",
				description = "When proposals stop, in the future; null for no deadline.") @Nullable Instant closesAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean hideOrganizationName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "True to publish at once, false to save a draft for the organization.") boolean publishNow,
		@Schema(types = { "array", "null" },
				description = "The programs it belongs to; none when absent.") @Size(
						max = 10) @Nullable List<@NotNull UUID> programIds) {
}
