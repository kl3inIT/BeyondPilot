package ai.genaifund.beyondpilot.messaging.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** The first message of a conversation. */
public record StartConversationRequest(
		@Schema(description = "An identifier the sender chooses for the first message. Retrying with it writes nothing more.") @NotNull UUID id,
		@Schema(allowableValues = { "talent", "solution", "program" }) @NotBlank @Pattern(
				regexp = "talent|solution|program") String kind,
		@Schema(description = "The address of the talent profile, solution or program on the site.") @NotBlank @Size(
				max = 200) String slug,
		@NotBlank @Size(max = 2000) String body) {
}
