package ai.genaifund.beyondpilot.proposal.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "MyApplication", description = "One of the person's applications, as My applications lists it.")
public record MyApplicationResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String programSlug, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String programName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant closesAt,
		@Schema(types = { "string", "null" }, format = "date") @Nullable LocalDate outcomesDueOn,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "draft", "submitted", "withdrawn" }) String status,
		@Schema(types = { "string", "null" }) @Nullable String organizationName,
		@Schema(types = { "string", "null" }) @Nullable String solutionName,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant submittedAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant updatedAt,
		@Schema(types = { "string", "null" }, allowableValues = { "shortlisted", "not_selected" },
				description = "GenAI Fund's decision, once the program's outcomes are released; null until then.") @Nullable String outcome) {
}
