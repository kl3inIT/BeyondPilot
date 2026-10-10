package ai.genaifund.beyondpilot.matching.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.jspecify.annotations.Nullable;

@Schema(name = "SaveMatchingSettings", description = "The limits of matching an operator sets.")
public record SaveMatchingSettingsRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, minimum = "0", maximum = "1440") @Min(0) @Max(1440) int settleMinutes,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, minimum = "0", maximum = "100") @Min(0) @Max(100) int editRunsPerDay,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, minimum = "0", maximum = "100") @Min(0) @Max(100) int memberRunsPerDay,
		@Schema(description = "Absent for no limit.", minimum = "1", maximum = "100000") @Nullable @Min(1) @Max(100000) Integer runsPerDay,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, minimum = "5", maximum = "200") @Min(5) @Max(200) int candidates,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, minimum = "1", maximum = "16") @Min(1) @Max(16) int parallel,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The version the operator read.") long version) {
}
