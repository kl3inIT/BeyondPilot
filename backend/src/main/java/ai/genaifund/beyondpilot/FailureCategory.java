package ai.genaifund.beyondpilot;

/**
 * The kind of an expected failure. The HTTP layer maps each category to one status (docs/conventions.md › API errors).
 */
public enum FailureCategory {
	VALIDATION,
	NOT_PERMITTED,
	NOT_FOUND,
	CONFLICT,
	GONE,
	LIMIT_EXCEEDED,
	SERVICE_UNAVAILABLE
}
