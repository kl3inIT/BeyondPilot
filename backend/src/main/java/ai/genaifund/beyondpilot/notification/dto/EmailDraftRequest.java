package ai.genaifund.beyondpilot.notification.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Schema(name = "EmailDraft", description = "Wording being edited, to preview or to send as a test.")
public record EmailDraftRequest(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Size(max = 200) String subject,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Markdown.") @NotNull @Size(max = 20000) String body) {
}
