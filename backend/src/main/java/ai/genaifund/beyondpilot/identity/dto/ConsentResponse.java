package ai.genaifund.beyondpilot.identity.dto;

import java.time.Instant;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "Consent", description = "The current consent text and what the caller agreed to under it.")
public record ConsentResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The version of the text; a choice records it.") int version,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The language of the text.") String locale,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The full consent text, in Markdown.") String text,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "True while the caller has not agreed to the platform purpose of the current version. The web sends them to the consent step from every page and the MCP servers refuse their tokens; the API itself still answers them.") boolean needed,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Every purpose, in the order the text lists them.") List<Purpose> purposes) {

	@Schema(name = "ConsentPurpose")
	public record Purpose(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					allowableValues = { "platform", "partners", "ai", "updates" }) String key,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "platform", "apply", "none" },
					description = "What needs it: using the platform, submitting an application or proposal, or nothing.") String requiredFor,
			@Schema(types = { "boolean", "null" },
					description = "The caller's current choice; null when they have not answered it under a version that still counts.") @Nullable Boolean granted,
			@Schema(types = { "string", "null" }, format = "date-time",
					description = "When the caller made that choice.") @Nullable Instant answeredAt) {
	}
}
