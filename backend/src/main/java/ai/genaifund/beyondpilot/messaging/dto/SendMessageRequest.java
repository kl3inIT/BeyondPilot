package ai.genaifund.beyondpilot.messaging.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** A message to write in an open conversation. */
public record SendMessageRequest(
		@Schema(description = "An identifier the sender chooses for the message. Sending it again writes nothing more, so a send that got no answer is safe to repeat.") @NotNull UUID id,
		@Schema(description = "The text; something other than spaces, in any script.") @NotBlank @Pattern(
				regexp = "(?Us).*\\S.*") @Size(max = 2000) String body) {
}
