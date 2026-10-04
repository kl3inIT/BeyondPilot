package ai.genaifund.beyondpilot.config;

import ai.genaifund.beyondpilot.ErrorCategory;
import org.springframework.http.HttpStatus;

/**
 * The HTTP status and the problem title of an error category (docs/conventions.md › API errors).
 */
record ErrorCategoryHttpStatus(HttpStatus status, String title) {

	static ErrorCategoryHttpStatus of(ErrorCategory category) {
		return switch (category) {
			case VALIDATION -> new ErrorCategoryHttpStatus(HttpStatus.BAD_REQUEST, "Validation failed");
			case NOT_PERMITTED -> new ErrorCategoryHttpStatus(HttpStatus.FORBIDDEN, "Not permitted");
			case NOT_FOUND -> new ErrorCategoryHttpStatus(HttpStatus.NOT_FOUND, "Not found");
			case CONFLICT -> new ErrorCategoryHttpStatus(HttpStatus.CONFLICT, "Conflict");
			case GONE -> new ErrorCategoryHttpStatus(HttpStatus.GONE, "No longer available");
			case LIMIT_EXCEEDED -> new ErrorCategoryHttpStatus(HttpStatus.TOO_MANY_REQUESTS, "Limit reached");
			case SERVICE_UNAVAILABLE -> new ErrorCategoryHttpStatus(HttpStatus.SERVICE_UNAVAILABLE, "Service unavailable");
		};
	}
}
