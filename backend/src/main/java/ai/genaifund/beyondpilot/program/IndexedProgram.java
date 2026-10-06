package ai.genaifund.beyondpilot.program;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * A published program as search indexes it: what its page says and the dates its phase is worked out from.
 * @param type the type as the API writes it
 * @param externalUrl the address of its page elsewhere, when it has no page here
 * @param applicationsOpenAt null for a program that takes no applications here
 * @param applicationsCloseAt null for a program that takes no applications here
 */
public record IndexedProgram(UUID id, String slug, String name, String type, @Nullable String partnerName,
		@Nullable String summary, @Nullable String about, @Nullable UUID coverFileId, @Nullable String externalUrl,
		@Nullable LocalDate startsOn, @Nullable LocalDate endsOn, @Nullable Instant applicationsOpenAt,
		@Nullable Instant applicationsCloseAt) {
}
