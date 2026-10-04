package ai.genaifund.beyondpilot.config;

import java.net.URI;
import java.time.Duration;
import java.util.Locale;

import ai.genaifund.beyondpilot.BusinessException;
import ai.genaifund.beyondpilot.ErrorCategory;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * The application's only exception handler (docs/conventions.md › API errors). Spring MVC's own failures keep the
 * problems {@link ResponseEntityExceptionHandler} already produces; this class adds module failures and the request
 * validation details. Unexpected exceptions are not caught here: they reach {@link ProblemErrorController}. The
 * request identifier is added by {@link RequestIdProblemAdvice}.
 */
@RestControllerAdvice
class ApiExceptionHandler extends ResponseEntityExceptionHandler {

	private static final String REQUEST_INVALID = "REQUEST_INVALID";

	@ExceptionHandler(BusinessException.class)
	ResponseEntity<ProblemDetail> handleBusinessException(BusinessException exception) {
		ProblemDetail problem = failure(exception.category(), exception.code(), exception.safeMessage());
		ResponseEntity.BodyBuilder response = ResponseEntity.status(problem.getStatus());
		Duration retryAfter = exception.retryAfter();
		if (retryAfter != null) {
			response.header(HttpHeaders.RETRY_AFTER, Long.toString(Math.max(1, (retryAfter.toMillis() + 999) / 1000)));
		}
		return response.body(problem);
	}

	@Override
	protected @Nullable ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException exception,
			HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		ProblemDetail problem = failure(ErrorCategory.VALIDATION, REQUEST_INVALID, "The request is invalid.");
		problem.setProperty("errors", exception.getBindingResult()
			.getFieldErrors()
			.stream()
			.map(RequestViolation::of)
			.sorted(RequestViolation.ORDER)
			.toList());
		return handleExceptionInternal(exception, problem, headers, HttpStatusCode.valueOf(problem.getStatus()),
				request);
	}

	private static ProblemDetail failure(ErrorCategory category, String code, String detail) {
		ErrorCategoryHttpStatus http = ErrorCategoryHttpStatus.of(category);
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(http.status(), detail);
		problem.setTitle(http.title());
		problem.setType(URI.create("urn:beyondpilot:failure:" + code.toLowerCase(Locale.ROOT).replace('_', '-')));
		problem.setProperty("code", code);
		return problem;
	}
}
