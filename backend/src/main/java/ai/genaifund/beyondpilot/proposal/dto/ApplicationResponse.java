package ai.genaifund.beyondpilot.proposal.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "Application", description = "A person's application to a program, as its form holds it now.")
public record ApplicationResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "draft", "submitted", "withdrawn" }) String status,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) ContactDetails contact,
		@Schema(types = { "string", "null" }) @Nullable String teamBackground,
		@Schema(types = { "string", "null" }, format = "uuid") @Nullable UUID solutionId,
		@Schema(types = { "object", "null" }) @Nullable AttachedFileResponse deck,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> builtWith,
		@Schema(types = { "string", "null" }) @Nullable String traction,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Map<String, String> answers,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The files the answers name, by question identifier.") Map<String, AttachedFileResponse> files,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "How many times it was submitted.") int submissions,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant submittedAt,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant withdrawnAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Sent back with a save, which is refused when the application changed since.") long version,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant updatedAt,
		@Schema(types = { "string", "null" }, allowableValues = { "shortlisted", "not_selected" },
				description = "GenAI Fund's decision, once the program's outcomes are released; null until then.") @Nullable String outcome) {
}
