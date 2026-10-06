package ai.genaifund.beyondpilot.proposal.dto;

import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "Release",
		description = "What releasing a program's outcomes sends, to whom, and whether it can be done now.")
public record ReleaseResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) ReviewHeadResponse head,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Applications have closed, every one has a decision, and nothing was released yet.") boolean ready,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<Item> shortlisted,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<Item> notSelected,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Still waiting for a decision.") List<Item> undecided,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long withdrawn,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The emails as they were sent, or a starting point until then.") ReleaseEmails emails) {

	@Schema(name = "ReleaseItem")
	public record Item(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String solutionName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String organizationName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String organizationType,
			@Schema(types = { "string", "null" }) @Nullable String country,
			@Schema(types = { "number", "null" }) @Nullable Double average) {
	}
}
