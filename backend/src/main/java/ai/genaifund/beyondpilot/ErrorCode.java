package ai.genaifund.beyondpilot;

/**
 * One entry of a module's catalogue of expected failures: a stable code, its category and the message a person may
 * see. A module implements it as an enum and throws it through its own {@link BusinessException} subclass.
 */
public interface ErrorCode {

	String code();

	ErrorCategory category();

	String message();
}
