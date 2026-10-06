package ai.genaifund.beyondpilot.talent.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "TalentSummary", description = "One talent profile in the operators' list.")
public record TalentSummaryResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String slug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The address of the account the profile belongs to.") String email,
		@Schema(types = { "string", "null" }) @Nullable String headline,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "draft", "in_review", "needs_changes", "approved" },
				description = "GenAI Fund's review of the profile.") String status,
		@Schema(types = { "string", "null" }, format = "date-time",
				description = "When it was taken down; null while it is not.") @Nullable Instant suspendedAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean listed,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant submittedAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant updatedAt) {
}
