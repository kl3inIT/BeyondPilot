package ai.genaifund.beyondpilot.matching;

import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * One run in detail, for a module that shows it outside the admin screen: what it cost, its steps, and which solutions
 * changed group since the run of the same use case before it.
 * @param previousRunId the run of the same use case before it; null for its first
 * @param compared whether both runs kept the group of each solution; groups and moves are empty when not
 */
public record MatchingRunDetail(MatchingRunList.Run run, List<Step> steps, @Nullable UUID previousRunId,
		boolean compared, List<Group> groups, List<Move> moves) {

	/**
	 * What the run did in one step.
	 * @param name {@code requirements}, {@code candidates} or {@code judgment}
	 */
	public record Step(String name, int takenIn, int givenOut, int calls, long inputTokens, long outputTokens,
			long millis) {
	}

	/**
	 * How many solutions a group held in the run before and in this one.
	 * @param bucket {@code direct}, {@code industry}, {@code technology} or {@code none}
	 */
	public record Group(String bucket, int before, int after) {
	}

	/**
	 * A solution whose group changed, entered or left.
	 * @param before its group in the run before; null when it was not in it
	 * @param after its group in this run; null when it left
	 */
	public record Move(UUID solutionId, @Nullable String solutionName, @Nullable String before,
			@Nullable String after) {
	}

}
