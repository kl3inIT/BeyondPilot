package ai.genaifund.beyondpilot.config;

import ai.genaifund.beyondpilot.FailureCategory;
import org.springframework.http.HttpStatus;

/**
 * How a failure category appears over HTTP: its status and the problem title (docs/conventions.md › API errors).
 */
record FailureRendering(HttpStatus status, String title) {

	static FailureRendering of(FailureCategory category) {
		return switch (category) {
			case VALIDATION -> new FailureRendering(HttpStatus.BAD_REQUEST, "Validation failed");
			case NOT_PERMITTED -> new FailureRendering(HttpStatus.FORBIDDEN, "Not permitted");
			case NOT_FOUND -> new FailureRendering(HttpStatus.NOT_FOUND, "Not found");
			case CONFLICT -> new FailureRendering(HttpStatus.CONFLICT, "Conflict");
			case GONE -> new FailureRendering(HttpStatus.GONE, "No longer available");
			case LIMIT_EXCEEDED -> new FailureRendering(HttpStatus.TOO_MANY_REQUESTS, "Limit reached");
			case SERVICE_UNAVAILABLE -> new FailureRendering(HttpStatus.SERVICE_UNAVAILABLE, "Service unavailable");
		};
	}
}
