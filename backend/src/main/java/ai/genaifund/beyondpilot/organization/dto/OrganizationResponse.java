package ai.genaifund.beyondpilot.organization.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "Organization", description = "An organization as the people who belong to it, and operators, see it.")
public record OrganizationResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String slug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "What it does here: `provider` lists AI solutions, `enterprise` posts use cases.") List<String> roles,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "company", "builder_team", "independent_builder", "other" }) String type,
		@Schema(types = { "string", "null" }) @Nullable String website,
		@Schema(types = { "string", "null" }, description = "ISO 3166-1 alpha-2.") @Nullable String country,
		@Schema(types = { "string", "null" }, description = "Null is unknown.",
				allowableValues = { "just_me", "2_9", "10_49", "50_99", "100_499", "500_999", "1000_4999",
						"5000_plus" }) @Nullable String teamSize,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The industries it works in or serves; empty until an owner names them.") List<String> industries,
		@Schema(types = { "string", "null" }) @Nullable String description,
		@Schema(types = { "string", "null" },
				description = "The domain whose addresses may join; null when it was made from a public mail address.") @Nullable String emailDomain,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether an address on the domain joins at once; otherwise it asks the owners.") boolean autoJoin,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "pending", "approved", "rejected" },
				description = "GenAI Fund's review of the organization.") String status,
		@Schema(types = { "string", "null" },
				allowableValues = { "duplicate", "not_a_real_organization", "incomplete", "out_of_scope",
						"other" },
				description = "Why it was last refused.") @Nullable String decisionReason,
		@Schema(types = { "string", "null" },
				description = "What the operator wrote to the owners with the refusal.") @Nullable String decisionMessage,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Sent back with a save, which is refused when the organization changed since.") long version,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt) {
}
