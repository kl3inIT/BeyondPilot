package ai.genaifund.beyondpilot.program.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "EventQuestion", description = "A question of an event's registration form, as the host wrote it on Luma.")
public record EventQuestionEntry(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String label,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "text", "select", "agree-check", "terms", "company", "phone-number", "url", "github",
						"instagram", "linkedin", "telegram", "twitter", "youtube" }) String type,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean required,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "For text, whether the answer may run over several lines.") boolean multiline,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "For select, what may be chosen.") List<String> options,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "For select, whether several options may be chosen.") boolean multiple,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "For company, whether the job title is asked beside it.") boolean jobTitle,
		@Schema(description = "For terms, the address of the terms to read.", format = "uri") @Nullable String termsUrl,
		@Schema(description = "For terms written out, their text in Markdown.") @Nullable String termsText,
		@Schema(allowableValues = { "name", "email" },
				description = "Answered from the person's name or email address, so not asked again.") @Nullable String known) {
}
