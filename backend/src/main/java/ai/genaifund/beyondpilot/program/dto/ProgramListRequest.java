package ai.genaifund.beyondpilot.program.dto;

import ai.genaifund.beyondpilot.program.ProgramPhase;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Pattern;
import org.jspecify.annotations.Nullable;

/** What narrows the public list of programs. Every member is optional. */
public record ProgramListRequest(
		@Parameter(description = "Only programs in this phase today.",
				schema = @Schema(allowableValues = { "upcoming", "open", "running", "done" })) @Pattern(
						regexp = ProgramPhase.CODES) @Nullable String phase,
		@Parameter(description = "Only programs of this type.", schema = @Schema(
				allowableValues = { "enterprise_challenge", "open_innovation_call", "accelerator", "hackathon",
						"buildathon", "grant", "venture_building", "pitch_competition", "event_series",
						"event" })) @Pattern(regexp = CreateProgramRequest.TYPE) @Nullable String type) {
}
