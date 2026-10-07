package ai.genaifund.beyondpilot.notification.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "EmailPreview",
		description = "A draft rendered with sample values, and what keeps it from being saved. With problems the rendering is the default's.")
public record EmailPreviewResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String subject, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String html, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String text, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<Problem> problems) {

	@Schema(name = "EmailTemplateProblem")
	public record Problem(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "syntax", "unknown_variable", "missing_variable", "subject_line" }) String type,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "subject", "body" }) String field,
			@Schema(types = { "string", "null" }) @Nullable String variable) {
	}

}
