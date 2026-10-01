package ai.genaifund.beyondpilot.config;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.webmvc.error.ErrorController;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The framework error path, replacing Spring Boot's default error JSON so that every failure that escapes the
 * exception handler (an unexpected exception, or an error raised in a servlet filter) is still an RFC 9457 problem.
 * A server failure never exposes its exception message.
 */
@RestController
class ProblemErrorController implements ErrorController {

	private static final Logger LOG = LoggerFactory.getLogger(ProblemErrorController.class);

	@RequestMapping("${server.error.path:${error.path:/error}}")
	ResponseEntity<ProblemDetail> error(HttpServletRequest request) {
		HttpStatus status = status(request);
		ProblemDetail problem = ProblemDetail.forStatus(status);
		problem.setTitle(status.getReasonPhrase());
		if (status.is5xxServerError()) {
			problem.setDetail("The server could not complete the request.");
			logFailure(request);
		}
		return ResponseEntity.status(status).body(problem);
	}

	private static HttpStatus status(HttpServletRequest request) {
		if (request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE) instanceof Integer code) {
			HttpStatus status = HttpStatus.resolve(code);
			if (status != null) {
				return status;
			}
		}
		return HttpStatus.INTERNAL_SERVER_ERROR;
	}

	/** The servlet container has already logged the stack trace; this line ties it to the request identifier. */
	private static void logFailure(HttpServletRequest request) {
		Object failure = request.getAttribute(RequestDispatcher.ERROR_EXCEPTION);
		LOG.atError()
			.addKeyValue("event", "http.request.failed")
			.addKeyValue("error_type", failure instanceof Throwable throwable ? throwable.getClass().getName() : "unknown")
			.addKeyValue("request_id", RequestIdFilter.requestId(request))
			.log("Request failed");
	}
}
