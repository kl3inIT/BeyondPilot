package ai.genaifund.beyondpilot.proposal.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "SolutionOption", description = "A solution of the applicant's organization, as step 2 shows it.")
public record SolutionOptionResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(types = { "string", "null" }) @Nullable String summary,
		@Schema(types = { "string", "null" }) @Nullable String problemsSolved,
		@Schema(types = { "string", "null" }) @Nullable String maturity,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether it has what an application needs: what it does, the problem it solves and its stage.") boolean complete) {
}
