package ai.genaifund.beyondpilot.messaging.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ConversationSubject",
		description = "What a conversation is about, as its public page says it now: a talent profile, a solution or a program.")
public record SubjectResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "talent", "solution", "program" }) String kind,
		@Schema(types = { "string", "null" },
				description = "Its address on the site; null once it has no public page.") @Nullable String slug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(types = { "string", "null" },
				description = "The organization that offers a solution; null for the other kinds.") @Nullable String organizationName,
		@Schema(types = { "string", "null" },
				description = "A talent profile's headline; null for the other kinds.") @Nullable String headline,
		@Schema(types = { "string", "null" },
				description = "A solution's summary or a person's bio; null when there is none.") @Nullable String summary,
		@Schema(types = { "string", "null" }, description = "ISO 3166-1 alpha-2.") @Nullable String country,
		@Schema(types = { "string", "null" }) @Nullable String city,
		@Schema(types = { "string", "null" },
				description = "How far a solution has come; null for the other kinds.") @Nullable String maturity,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The industries of a solution or a person; empty for a program.") List<String> industries,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "A person's roles; empty for the other kinds.") List<String> roles,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "A person's skills; empty for the other kinds.") List<String> skills,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many of a solution's customer deployments GenAI Fund approved; 0 for the other kinds.") int customerDeployments) {
}
