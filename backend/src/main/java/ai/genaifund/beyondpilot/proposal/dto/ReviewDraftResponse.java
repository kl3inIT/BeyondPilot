package ai.genaifund.beyondpilot.proposal.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "ReviewDraft",
		description = "An application not submitted yet, as it stands now, for an operator; judges never read it.")
public record ReviewDraftResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) ReviewHeadResponse head,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant startedAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant lastSavedAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "What the draft holds now, in the shape of a submission; a part not written yet is empty.") ReviewApplicationResponse.Submitted draft) {
}
