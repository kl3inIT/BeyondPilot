package ai.genaifund.beyondpilot.talent.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "TalentProject", description = "One piece of work a talent profile shows.")
public record TalentProjectDto(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 120) String title,
		@Schema(types = { "string", "null" }) @Size(max = 600) @Nullable String summary,
		@Schema(types = { "string", "null" }) @Size(max = 300) @Pattern(
				regexp = TalentCodes.URL) @Nullable String url,
		@Schema(types = { "integer", "null" }, format = "int32",
				description = "The year the work was done.") @Min(1990) @Max(2100) @Nullable Integer year) {
}
