package ai.genaifund.beyondpilot.matching.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "InviteMatchingCandidate", description = "Invites the provider of a candidate to propose for the use case.")
public record InviteCandidateRequest(
		@Schema(description = "A few words to the provider, quoted in the email.") @Nullable @Size(max = 500) String note) {
}
