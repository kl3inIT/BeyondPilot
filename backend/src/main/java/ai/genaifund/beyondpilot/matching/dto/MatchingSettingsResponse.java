package ai.genaifund.beyondpilot.matching.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "MatchingSettings", description = "The limits of matching, as operators set them.")
public record MatchingSettingsResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many minutes a use case must stay unchanged before the run its change asked for starts.") int settleMinutes,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many runs a day the changes of one use case may start.") int editRunsPerDay,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many runs a day the members of its organization may start for one use case.") int memberRunsPerDay,
		@Schema(description = "How many runs a day start in all; absent for no limit.") @Nullable Integer runsPerDay,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "How many solutions a run judges.") int candidates,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many solutions a run judges at the same time.") int parallel,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Sent back with a change, so that two operators do not overwrite each other.") long version) {
}
