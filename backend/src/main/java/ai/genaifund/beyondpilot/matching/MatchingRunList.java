package ai.genaifund.beyondpilot.matching;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * One page of the runs of every use case, the newest first, for a module that shows them outside the admin screen.
 * @param page the page, counted from 1
 * @param total how many runs there are, over all pages
 */
public record MatchingRunList(List<Run> items, int page, int size, long total) {

	/**
	 * One run of matching for a use case, with what its calls to the AI came to.
	 * @param useCaseTitle null when the use case is no longer published
	 * @param state {@code queued}, {@code running}, {@code waiting}, {@code done} or {@code failed}
	 * @param origin what started it: {@code approved} (the use case's approval or a change), {@code operator} or
	 * {@code member}
	 * @param startedBy who started it; null when the approval or a change did
	 * @param failure why it failed or waits, as a code
	 * @param judged how many solutions it judged itself; null for a run before the groups were kept
	 * @param kept how many it found unchanged and kept as judged before; null like judged
	 * @param cost the estimated cost in US dollars of the calls with a known price; null when none has one
	 */
	public record Run(UUID id, UUID useCaseId, @Nullable String useCaseTitle, String state, String origin,
			@Nullable String startedBy, @Nullable String modelName, @Nullable String failure, Instant createdAt,
			@Nullable Instant startedAt, @Nullable Instant endedAt, @Nullable Integer judged, @Nullable Integer kept,
			long calls, long failedCalls, long inputTokens, long outputTokens, @Nullable BigDecimal cost) {
	}

}
