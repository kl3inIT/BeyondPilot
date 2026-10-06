package ai.genaifund.beyondpilot.program.dto;

import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "ProgramQuestion", description = "A question a program asks its applicants.")
public record ProgramQuestionEntry(
		@Schema(types = { "string", "null" }, format = "uuid",
				description = "Null for a new question; an answer names its question by it.") @Nullable UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "short_text", "long_text",
				"single_choice", "file", "link", "confirm" }) @NotNull @Pattern(regexp = KIND) String kind,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 300) String label,
		@Schema(types = { "string", "null" },
				description = "What helps an applicant answer, shown under the field.") @Size(
						max = 600) @Nullable String help,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean required,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The choices of a single_choice question, two to twenty; empty otherwise.") @NotNull @Size(
						max = 20) List<@NotBlank @Size(max = 160) String> options,
		@Schema(types = { "integer", "null" },
				description = "The longest answer to a text question; null takes the form's default.") @Min(1) @Max(
						4000) @Nullable Integer maxLength) {

	public static final String KIND = "short_text|long_text|single_choice|file|link|confirm";
}
