package ai.genaifund.beyondpilot.matching;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import org.jspecify.annotations.Nullable;

/**
 * What the model answers for one candidate. Every field may be missing in an answer, and code reads a missing one as
 * nothing shown. The fields are in the order the model is asked to fill them: what it found, then what it makes of it.
 * @param findings one per requirement
 * @param problemFit whether the product is made for the job the use case's problem describes
 * @param industryFit whether the vendor delivered a similar workflow in the use case's industry
 * @param technologyFit whether the product is built on, or delivers, the technologies the use case names
 * @param summary one sentence: the strongest reason, or the main thing that is missing
 */
@JsonPropertyOrder({ "findings", "problemFit", "industryFit", "technologyFit", "summary" })
record Judgment(@Nullable List<Finding> findings, @Nullable Fit problemFit, @Nullable Fit industryFit,
		@Nullable Fit technologyFit, @Nullable String summary) {

	static final String MET = "met";

	static final String PARTLY = "partly";

	static final String NOT_SHOWN = "not_shown";

	/**
	 * @param requirementId the requirement as it was named to the model: R1, R2 and so on
	 * @param quote the words of a source, copied
	 * @param source the label of that source
	 * @param reason one sentence: what the quote shows, set against the requirement
	 * @param status {@link #MET}, {@link #PARTLY} or {@link #NOT_SHOWN}
	 */
	@JsonPropertyOrder({ "requirementId", "quote", "source", "reason", "status" })
	record Finding(@Nullable String requirementId, @Nullable String quote, @Nullable String source,
			@Nullable String reason, @Nullable String status) {
	}

	/** A quote, its source, a reason and a status, as a finding has them. */
	@JsonPropertyOrder({ "quote", "source", "reason", "status" })
	record Fit(@Nullable String quote, @Nullable String source, @Nullable String reason, @Nullable String status) {
	}

}
