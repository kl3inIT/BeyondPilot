package ai.genaifund.beyondpilot.program.dto;

import java.time.Instant;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "LumaConnection",
		description = "The Luma calendar BeyondPilot reads, as an operator sees it on the Luma tab of Programs. The key itself is never returned.")
public record LumaConnectionResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "False while this environment has no encryption key, so no Luma key can be kept.") boolean encryptionReady,
		@Schema(description = "The connected calendar; absent when none is.") @Nullable Calendar calendar) {

	@Schema(name = "LumaCalendar")
	public record Calendar(@Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "cal-KxQE75V2Ywj0ZDI") String id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "GenAI Fund - Official") String name,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "The last characters of the key in use.", example = "6wZL") String keyEnding,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Whether Luma tells BeyondPilot of a change at once; without it the hourly read still runs.") boolean webhook,
			@Schema(description = "Why no webhook could be made; absent when one was.") @Nullable String webhookError,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant connectedAt,
			@Schema(description = "When the calendar was last read; absent before the first read.") @Nullable Instant lastReadAt,
			@Schema(description = "Why the last read failed; absent when it succeeded.") @Nullable String lastReadError) {
	}

}
