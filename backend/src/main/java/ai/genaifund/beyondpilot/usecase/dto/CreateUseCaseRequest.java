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
		published at once when publishNow is true.""")
public record CreateUseCaseRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "An approved organization.") @NotNull UUID organizationId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 200) String title,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 2000) String problemStatement,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Pattern(
				regexp = UseCaseCodes.INDUSTRY) String industry,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Size(min = 1,
				max = 11) List<@NotNull @Pattern(regexp = UseCaseCodes.TECHNOLOGY) String> technologies,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 2000) String expectedOutcomes,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 2000) String currentProcess,
		@Schema(types = { "string", "null" }) @Size(max = 2000) @Nullable String currentSolutions,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 2000) String targetUsers,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "What the solution must do, in the order written.") @NotNull @Size(min = 1,
						max = 30) List<@NotNull @Valid UseCaseRequirementEntry> requirements,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 2000) String dataReadiness,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(
				max = 2000) String integrationRequirements,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Files the caller uploaded for a use case, in the order shown.") @NotNull @Size(
						max = 10) List<@NotNull UUID> attachmentFileIds,
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
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Min(1) @Max(
				260) Integer timelineMinWeeks,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Min(1) @Max(
				260) Integer timelineMaxWeeks,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "When proposals stop. It must be in the future.") @NotNull Instant closesAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean hideOrganizationName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "True to publish at once, false to save a draft for the organization.") boolean publishNow,
		@Schema(types = { "array", "null" },
				description = "The programs it belongs to; none when absent.") @Size(
						max = 10) @Nullable List<@NotNull UUID> programIds) {
}
