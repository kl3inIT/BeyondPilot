package ai.genaifund.beyondpilot;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.Objects;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import com.jayway.jsonpath.JsonPath;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.test.web.servlet.client.EntityExchangeResult;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The error contract of docs/conventions.md › API errors, over real HTTP so that the servlet error path is part of the
 * test: every failure is an RFC 9457 problem that carries the request identifier sent in {@code X-Request-Id}.
 * The refusals of the security filter chain are among them.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import({ TestcontainersConfiguration.class, ProblemResponsesTest.FailingController.class })
class ProblemResponsesTest {

	@LocalServerPort
	private int port;

	private RestTestClient client;

	@BeforeEach
	void setUp() {
		client = RestTestClient.bindToServer(new JdkClientHttpRequestFactory()).baseUrl("http://localhost:" + port).build();
	}

	@Test
	void expectedFailureIsAProblemWithItsCodeAndType() {
		EntityExchangeResult<byte[]> result = client.get()
			.uri("/test/conflict")
			.exchange()
			.expectStatus()
			.isEqualTo(409)
			.expectHeader()
			.contentType(MediaType.APPLICATION_PROBLEM_JSON)
			.expectBody()
			.jsonPath("$.type")
			.isEqualTo("urn:beyondpilot:failure:test-conflict")
			.jsonPath("$.title")
			.isEqualTo("Conflict")
			.jsonPath("$.detail")
			.isEqualTo("The example conflicts with existing state.")
			.jsonPath("$.code")
			.isEqualTo("TEST_CONFLICT")
			.returnResult();

		assertProblemShape(result);
		assertThat(body(result)).doesNotContain("diagnostic detail for logs");
		assertThat(result.getResponseHeaders().containsHeader("Retry-After")).isFalse();
	}

	@Test
	void limitFailureTellsTheClientWhenToRetryInWholeSeconds() {
		EntityExchangeResult<byte[]> result = client.get()
			.uri("/test/limit")
			.exchange()
			.expectStatus()
			.isEqualTo(429)
			.expectHeader()
			.valueEquals("Retry-After", "30")
			.expectHeader()
			.contentType(MediaType.APPLICATION_PROBLEM_JSON)
			.expectBody()
			.jsonPath("$.type")
			.isEqualTo("urn:beyondpilot:failure:test-limit-reached")
			.jsonPath("$.title")
			.isEqualTo("Limit reached")
			.returnResult();

		assertProblemShape(result);
	}

	@Test
	void invalidBodyListsEachViolationWithAPointerAndNeverTheRejectedValue() {
		EntityExchangeResult<byte[]> result = client.post()
			.uri("/test/examples")
			.header("X-BeyondPilot-CSRF", "1")
			.contentType(MediaType.APPLICATION_JSON)
			.body("{\"name\":\"\",\"code\":\"rejected-secret-value\"}")
			.exchange()
			.expectStatus()
			.isBadRequest()
			.expectHeader()
			.contentType(MediaType.APPLICATION_PROBLEM_JSON)
			.expectBody()
			.jsonPath("$.type")
			.isEqualTo("urn:beyondpilot:failure:request-invalid")
			.jsonPath("$.code")
			.isEqualTo("REQUEST_INVALID")
			.jsonPath("$.errors.length()")
			.isEqualTo(2)
			.jsonPath("$.errors[0].pointer")
			.isEqualTo("#/code")
			.jsonPath("$.errors[0].code")
			.isEqualTo("SIZE")
			.jsonPath("$.errors[0].params.min")
			.isEqualTo(2)
			.jsonPath("$.errors[0].params.max")
			.isEqualTo(5)
			.jsonPath("$.errors[1].pointer")
			.isEqualTo("#/name")
			.jsonPath("$.errors[1].code")
			.isEqualTo("NOT_BLANK")
			.jsonPath("$.errors[1].params")
			.doesNotExist()
			.returnResult();

		assertProblemShape(result);
		assertThat(body(result)).doesNotContain("rejected-secret-value");
	}

	@Test
	void malformedJsonIsAProblem() {
		EntityExchangeResult<byte[]> result = client.post()
			.uri("/test/examples")
			.header("X-BeyondPilot-CSRF", "1")
			.contentType(MediaType.APPLICATION_JSON)
			.body("{")
			.exchange()
			.expectStatus()
			.isBadRequest()
			.expectHeader()
			.contentType(MediaType.APPLICATION_PROBLEM_JSON)
			.expectBody()
			.returnResult();

		assertProblemShape(result);
	}

	@Test
	void unknownPathIsANotFoundProblem() {
		EntityExchangeResult<byte[]> result = client.get()
			.uri("/does-not-exist")
			.exchange()
			.expectStatus()
			.isNotFound()
			.expectHeader()
			.contentType(MediaType.APPLICATION_PROBLEM_JSON)
			.expectBody()
			.returnResult();

		assertProblemShape(result);
	}

	@Test
	void anApiPathWithoutASessionIsAnUnauthorizedProblem() {
		EntityExchangeResult<byte[]> result = client.get()
			.uri("/api/does-not-exist")
			.exchange()
			.expectStatus()
			.isUnauthorized()
			.expectHeader()
			.contentType(MediaType.APPLICATION_PROBLEM_JSON)
			.expectBody()
			.jsonPath("$.instance")
			.isEqualTo("/api/does-not-exist")
			.returnResult();

		assertProblemShape(result);
	}

	@Test
	void aStateChangingRequestWithoutTheCsrfHeaderIsAForbiddenProblem() {
		EntityExchangeResult<byte[]> result = client.post()
			.uri("/test/examples")
			.contentType(MediaType.APPLICATION_JSON)
			.body("{\"name\":\"ok\",\"code\":\"abc\"}")
			.exchange()
			.expectStatus()
			.isForbidden()
			.expectHeader()
			.contentType(MediaType.APPLICATION_PROBLEM_JSON)
			.expectBody()
			.returnResult();

		assertProblemShape(result);
	}

	@Test
	void unexpectedFailureIsAGenericServerProblemWithoutInternalDetail() {
		EntityExchangeResult<byte[]> result = client.get()
			.uri("/test/crash")
			.exchange()
			.expectStatus()
			.isEqualTo(500)
			.expectHeader()
			.contentType(MediaType.APPLICATION_PROBLEM_JSON)
			.expectBody()
			.jsonPath("$.detail")
			.isEqualTo("The server could not complete the request.")
			.returnResult();

		assertProblemShape(result);
		assertThat(body(result)).doesNotContain("internal secret").doesNotContain("IllegalStateException");
	}

	/** The members openapi.yml declares required on every problem, with requestId equal to the response header. */
	private static void assertProblemShape(EntityExchangeResult<byte[]> result) {
		String body = body(result);
		String header = result.getResponseHeaders().getFirst("X-Request-Id");
		assertThat(header).isNotBlank();
		assertThat(JsonPath.<String>read(body, "$.requestId")).isEqualTo(header);
		assertThat(JsonPath.<String>read(body, "$.title")).isNotBlank();
		assertThat(JsonPath.<Integer>read(body, "$.status")).isEqualTo(result.getStatus().value());
	}

	private static String body(EntityExchangeResult<byte[]> result) {
		return new String(Objects.requireNonNull(result.getResponseBody()), UTF_8);
	}

	@RestController
	static class FailingController {

		@GetMapping("/test/conflict")
		void conflict() {
			throw new ExampleException(ExampleErrorCode.CONFLICT, null);
		}

		@GetMapping("/test/limit")
		void limit() {
			throw new ExampleException(ExampleErrorCode.LIMIT_REACHED, Duration.ofMillis(29_200));
		}

		@PostMapping("/test/examples")
		void create(@Valid @RequestBody ExampleRequest request) {
		}

		@GetMapping("/test/crash")
		void crash() {
			throw new IllegalStateException("internal secret: jdbc:postgresql://db/beyondpilot");
		}
	}

	record ExampleRequest(@NotBlank String name, @Size(min = 2, max = 5) String code) {
	}

	enum ExampleErrorCode implements ErrorCode {

		CONFLICT("TEST_CONFLICT", ErrorCategory.CONFLICT, "The example conflicts with existing state."),
		LIMIT_REACHED("TEST_LIMIT_REACHED", ErrorCategory.LIMIT_EXCEEDED, "Too many examples; try again later.");

		private final String code;
		private final ErrorCategory category;
		private final String message;

		ExampleErrorCode(String code, ErrorCategory category, String message) {
			this.code = code;
			this.category = category;
			this.message = message;
		}

		@Override
		public String code() {
			return code;
		}

		@Override
		public ErrorCategory category() {
			return category;
		}

		@Override
		public String message() {
			return message;
		}
	}

	static final class ExampleException extends BusinessException {

		private final @Nullable Duration retryAfter;

		ExampleException(ExampleErrorCode errorCode, @Nullable Duration retryAfter) {
			super(errorCode, "diagnostic detail for logs");
			this.retryAfter = retryAfter;
		}

		@Override
		public @Nullable Duration retryAfter() {
			return retryAfter;
		}
	}
}
