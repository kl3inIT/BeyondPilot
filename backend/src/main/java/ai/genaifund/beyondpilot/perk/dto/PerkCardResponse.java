package ai.genaifund.beyondpilot.perk.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "PerkCard", description = "A published perk as the catalogue and a program's page show it.")
public record PerkCardResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String slug, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
		@Schema(types = { "string", "null" }) @Nullable String value,
		@Schema(types = { "string", "null" }) @Nullable String summary, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String organizationName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String organizationSlug,
		@Schema(types = { "string", "null" }, format = "uuid",
				description = "The partner's logo.") @Nullable UUID organizationLogoFileId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "everyone", "members", "applicants", "shortlisted" }) String audience,
		@Schema(types = { "string", "null" }) @Nullable String programName,
		@Schema(types = { "string", "null" }) @Nullable String programSlug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "link", "code", "codes", "request" }) String way,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant endsAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "True once its end has passed; it can no longer be got.") boolean ended,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "True when every place is taken.") boolean full,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "True when GenAI Fund arranged it.") boolean fromGenAiFund,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "eligible", "sign_in", "organization",
				"not_applied", "not_shortlisted", "not_started", "ended", "full", "claimed", "archived" },
				description = "Whether the caller may get it now, or why not.") String standing,
		@Schema(types = { "string", "null" }, allowableValues = { "taken", "waiting", "granted", "declined" },
				description = "What the caller holds of it; null for nothing, and for someone signed out.") @Nullable String claimState) {
}
