package ai.genaifund.beyondpilot.messaging.dto;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Who the caller means to write to. */
public record ProspectRequest(
		@Parameter(required = true,
				schema = @Schema(allowableValues = { "talent", "solution", "program" })) @NotBlank @Pattern(
						regexp = "talent|solution|program") String kind,
		@Parameter(required = true,
				description = "The address of the talent profile, solution or program on the site.") @NotBlank @Size(
						max = 200) String slug) {
}
