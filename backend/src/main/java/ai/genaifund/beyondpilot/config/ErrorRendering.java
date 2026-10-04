package ai.genaifund.beyondpilot.config;

import ai.genaifund.beyondpilot.ErrorCategory;
import org.springframework.http.HttpStatus;

/**
 * How a failure category appears over HTTP: its status and the problem title (docs/conventions.md › API errors).
 */
record ErrorRendering(HttpStatus status, String title) {

	static ErrorRendering of(ErrorCategory category) {
		return switch (category) {
			case VALIDATION -> new ErrorRendering(HttpStatus.BAD_REQUEST, "Validation failed");
			case NOT_PERMITTED -> new ErrorRendering(HttpStatus.FORBIDDEN, "Not permitted");
			case NOT_FOUND -> new ErrorRendering(HttpStatus.NOT_FOUND, "Not found");
			case CONFLICT -> new ErrorRendering(HttpStatus.CONFLICT, "Conflict");
			case GONE -> new ErrorRendering(HttpStatus.GONE, "No longer available");
			case LIMIT_EXCEEDED -> new ErrorRendering(HttpStatus.TOO_MANY_REQUESTS, "Limit reached");
			case SERVICE_UNAVAILABLE -> new ErrorRendering(HttpStatus.SERVICE_UNAVAILABLE, "Service unavailable");
		};
	}
}
