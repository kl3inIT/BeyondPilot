package ai.genaifund.beyondpilot.program.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(name = "CreateProgram", description = "What a program cannot do without. It is created as a draft.")
public record CreateProgramRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 120) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "insurance-ai-tasco",
				description = "The address under /programs: lowercase letters, digits and single hyphens.") @NotNull @Size(
						min = 3, max = 60) @Pattern(regexp = SLUG) String slug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "enterprise_challenge", "open_innovation_call", "accelerator", "hackathon",
						"buildathon", "grant", "venture_building", "pitch_competition", "event_series",
						"event" }) @NotNull @Pattern(regexp = TYPE) String type) {

	static final String SLUG = "[a-z0-9]+(-[a-z0-9]+)*";

	static final String TYPE = "enterprise_challenge|open_innovation_call|accelerator|hackathon|buildathon"
			+ "|grant|venture_building|pitch_competition|event_series|event";
}
