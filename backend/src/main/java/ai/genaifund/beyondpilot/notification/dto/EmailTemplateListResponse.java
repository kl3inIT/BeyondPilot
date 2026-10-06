package ai.genaifund.beyondpilot.notification.dto;

import java.time.Instant;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "EmailTemplateList", description = "Every kind of email operators can word, in the order the screen groups them.")
public record EmailTemplateListResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<Item> items) {

	@Schema(name = "EmailTemplateListItem")
	public record Item(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String kind,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "sign_in", "organizations", "applications", "introductions", "use_cases", "talent" }) String group,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The subject in use, with its variables as written.") String subject,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Whether an operator's wording replaces the default.") boolean edited,
			@Schema(types = { "string", "null" }) @Nullable String updatedBy,
			@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant updatedAt) {
	}

}
