package ai.genaifund.beyondpilot.notification.dto;

import java.time.Instant;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "EmailTemplate", description = "The wording of one kind of email, with the default it replaces and what it may use.")
public record EmailTemplateResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String kind,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "sign_in", "organizations", "applications", "introductions", "use_cases", "talent" }) String group,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String subject, @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Markdown.") String body, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String defaultSubject, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String defaultBody,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<Variable> variables, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean edited,
		@Schema(types = { "string", "null" }) @Nullable String updatedBy,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant updatedAt,
		@Schema(types = { "integer", "null" }, format = "int64",
				description = "The version of the operator's wording; null while the default is in use.") @Nullable Long version) {

	@Schema(name = "EmailTemplateVariable")
	public record Variable(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean required,
			@Schema(types = { "string", "null" }, description = "What the preview puts in its place.") @Nullable String sample) {
	}

}
