package ai.genaifund.beyondpilot.notification.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "EmailDraft", description = "Wording being edited, to preview or to send as a test.")
public record EmailDraftRequest(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Size(max = 200) String subject,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Markdown.") @NotNull @Size(max = 20000) String body,
		@Schema(types = { "object", "null" },
				description = "An appearance being edited, to see it before it is saved; null for the saved one.") @Valid @Nullable Appearance appearance) {

	@Schema(name = "EmailDraftAppearance")
	public record Appearance(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "#0070C0") @NotNull @Pattern(regexp = "#[0-9A-Fa-f]{6}") String accentColor,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Size(max = 500) String footer) {
	}

}
