package ai.genaifund.beyondpilot.notification.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "SaveEmailTemplate", description = "An operator's wording of one kind of email.")
public record SaveEmailTemplateRequest(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 200) String subject,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Markdown.") @NotBlank @Size(max = 20000) String body,
		@Schema(types = { "integer", "null" }, format = "int64",
				description = "The version read; null when the default was in use.") @Nullable Long version) {
}
