package ai.genaifund.beyondpilot.matching.dto;

import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

/**
 * One change of what matching holds for a use case, as the stream of changes sends it: the kind is the name of the
 * event, and this is its body. It says that something changed and carries no state; the reader reads the state again.
 */
@Schema(name = "MatchingChange",
		description = "The body of one event of a use case's stream of changes. The name of the event says what changed; the state itself is read again with `getMatching`.")
public record MatchingChange(@JsonIgnore @Schema(hidden = true) Kind kind,
		@JsonInclude(JsonInclude.Include.NON_NULL) @Schema(
				description = "The solution whose judgment starts (`reading`) or ended (`read`); absent on every other event.") @Nullable UUID solutionId) {

	/** What changed. The name of the event is the constant in lower case. */
	public enum Kind {

		/** A run was queued, moved, started, has to wait, ended or failed. */
		RUN,

		/** The requirements of the brief are read. */
		BRIEF,

		/** The candidates are found. */
		FOUND,

		/** The judgment of one solution starts. */
		READING,

		/** The judgment of one solution ended: it was kept, was not needed, or failed. */
		READ,

		/**
		 * A person shortlisted, removed or restored a candidate, an operator added one by hand, or someone said
		 * whether the AI put one in the right group.
		 */
		DECISION

	}

}
