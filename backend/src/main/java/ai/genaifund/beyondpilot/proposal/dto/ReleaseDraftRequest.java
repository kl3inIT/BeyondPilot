package ai.genaifund.beyondpilot.proposal.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Schema(name = "ReleaseDraftRequest",
		description = "The email of each group as it is being written. A subject or a message may be empty until the release.")
public record ReleaseDraftRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Size(max = 200) String shortlistedSubject,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Size(max = 5000) String shortlistedMessage,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Size(max = 200) String notSelectedSubject,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Size(max = 5000) String notSelectedMessage) {
}
