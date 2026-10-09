package ai.genaifund.beyondpilot.usecase.persistence;

import jakarta.persistence.Embeddable;

/**
 * One thing the solution must do.
 * @param necessity {@code required} or {@code optional}
 */
@Embeddable
public record UseCaseRequirement(String statement, String necessity) {

	public static final String REQUIRED = "required";

}
