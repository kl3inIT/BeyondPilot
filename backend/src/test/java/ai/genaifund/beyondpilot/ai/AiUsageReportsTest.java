package ai.genaifund.beyondpilot.ai;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import ai.genaifund.beyondpilot.TestMailbox;
import ai.genaifund.beyondpilot.TestcontainersConfiguration;
import ai.genaifund.beyondpilot.identity.TestSignIn;
import com.jayway.jsonpath.JsonPath;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.client.RestTestClient;

/**
 * Admin › AI › Usage over real HTTP against PostgreSQL. The calls are rows written by the test, as the recorders write
 * them; no provider is called.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = "beyondpilot.identity.operator-emails=operator@usage.test")
@Import({ TestcontainersConfiguration.class, AiUsageReportsTest.Mail.class })
class AiUsageReportsTest {

	private static final String API = "/api/ai/admin/usage";

	private static final ZoneId VIETNAM = ZoneId.of("Asia/Ho_Chi_Minh");

	@LocalServerPort
	private int port;

	@Autowired
	private TestMailbox mail;

	@Autowired
	private JdbcClient jdbc;

	private RestTestClient client;

	private String operator;

	@BeforeEach
	void setUp() {
		jdbc.sql("delete from ai_usage").update();
		jdbc.sql("update ai_task_model set model_id = null, ocr_provider_id = null, reasoning_effort = null, version = 0")
			.update();
		jdbc.sql("delete from ai_provider where purpose in ('chat', 'ocr')").update();
		client = RestTestClient.bindToServer(new JdkClientHttpRequestFactory()).baseUrl("http://localhost:" + port).build();
		operator = TestSignIn.session(client, mail, "operator@usage.test");
	}

	@Test
	void onlyOperatorsReadTheUsage() {
		String member = TestSignIn.session(client, mail, "member@usage.test");

		assertProblem(get(member, "/overview"), 403, "IDENTITY_OPERATOR_REQUIRED");
		assertProblem(get(member, "/calls"), 403, "IDENTITY_OPERATOR_REQUIRED");
	}

	@Test
	void theTotalsCostWhatIsPricedAndCountApartWhatIsNot() {
		Instant now = Instant.now();
		// 600,000 fresh input at 2, 400,000 cached at 0.5 and 100,000 output at 10, per million: 1.2 + 0.2 + 1.0.
		model(now, "matching", "gpt", "ok", null, 1_000_000L, 100_000L, 400_000L, "2", "10", "0.5");
		// No cached price: the cached input costs the input price. 1,000,000 at 2.
		model(now, "matching", "gpt", "ok", null, 1_000_000L, 0L, 400_000L, "2", "10", null);
		// Answered, without a price: counted apart, and nothing added to the cost.
		model(now, "matching", "gpt", "ok", null, 500L, 20L, null, null, null, null);
		// Refused by the provider: a call, no cost, and not one whose price is unavailable.
		model(now, "matching", "gpt", "failed", 413, null, null, null, "2", "10", null);
		// An OCR service at 1.50 per 1,000 calls.
		ocr(now, "ok", null, "1.5");
		// Yesterday's call is not today's.
		model(now.minus(Duration.ofHours(25)), "matching", "gpt", "ok", null, 9L, 9L, null, "2", "10", null);

		String today = body(get(operator, "/overview").expectStatus().isOk());

		assertThat(JsonPath.<String>read(today, "$.period")).isEqualTo("today");
		assertThat(JsonPath.<Integer>read(today, "$.totals.calls")).isEqualTo(5);
		assertThat(JsonPath.<Integer>read(today, "$.totals.succeeded")).isEqualTo(4);
		assertThat(JsonPath.<Integer>read(today, "$.totals.failed")).isEqualTo(1);
		assertThat(JsonPath.<Integer>read(today, "$.totals.inputTokens")).isEqualTo(2_000_500);
		assertThat(JsonPath.<Integer>read(today, "$.totals.outputTokens")).isEqualTo(100_020);
		assertThat(JsonPath.<Number>read(today, "$.totals.estimatedCost").doubleValue()).isCloseTo(4.4015, within(1e-9));
		assertThat(JsonPath.<Integer>read(today, "$.totals.pricedCalls")).isEqualTo(3);
		assertThat(JsonPath.<Integer>read(today, "$.totals.unpricedCalls")).isEqualTo(1);

		String week = body(get(operator, "/overview?period=7d").expectStatus().isOk());
		assertThat(JsonPath.<Integer>read(week, "$.totals.calls")).isEqualTo(6);
	}

	@Test
	void aPeriodWithoutCallsIsAllZeroWithNoCost() {
		String empty = body(get(operator, "/overview?period=30d").expectStatus().isOk());

		assertThat(JsonPath.<Integer>read(empty, "$.totals.calls")).isZero();
		assertThat(JsonPath.<Object>read(empty, "$.totals.estimatedCost")).isNull();
		assertThat(JsonPath.<List<Object>>read(empty, "$.failing")).isEmpty();
		assertThat(JsonPath.<List<Object>>read(empty, "$.breakdown")).isEmpty();
		assertThat(JsonPath.<List<Object>>read(empty, "$.series")).hasSize(30);
	}

	@Test
	void aTaskIsFailingFromFiveFailedCallsThatAreATenthOfItsCalls() {
		Instant now = Instant.now();
		// Five of twenty: failing. Its last failure was a request too large.
		calls(now, "document_reading", "luna", 15, 0);
		for (int index = 0; index < 4; index++) {
			model(now.minusSeconds(60 + index), "document_reading", "luna", "failed", 500, null, null, null, null, null,
					null);
		}
		model(now.minusSeconds(5), "document_reading", "luna", "failed", 413, null, null, null, null, null, null);
		// Four failed: too few, although they are nearly half.
		calls(now, "matching", "few", 6, 4);
		// Five failed of a hundred: too small a part.
		calls(now, "matching", "many", 95, 5);

		// What is failing is judged on the last day, whatever period is shown.
		for (String period : List.of("today", "30d")) {
			String overview = body(get(operator, "/overview?period=" + period).expectStatus().isOk());

			assertThat(JsonPath.<List<String>>read(overview, "$.failing[*].modelName")).containsExactly("luna");
			assertThat(JsonPath.<String>read(overview, "$.failing[0].task")).isEqualTo("document_reading");
			assertThat(JsonPath.<String>read(overview, "$.failing[0].providerName")).isEqualTo("9Router");
			assertThat(JsonPath.<Integer>read(overview, "$.failing[0].calls")).isEqualTo(20);
			assertThat(JsonPath.<Integer>read(overview, "$.failing[0].failed")).isEqualTo(5);
			assertThat(JsonPath.<String>read(overview, "$.failing[0].lastFailure")).isEqualTo("too_large");
			// No task runs on it: these calls carry a provider nothing is connected as.
			assertThat(JsonPath.<Boolean>read(overview, "$.failing[0].assigned")).isFalse();
		}
	}

	@Test
	void aFailingTaskSaysWhetherItStillRunsOnThatModel() {
		Instant now = Instant.now();
		UUID router = provider("chat", "9Router");
		UUID luna = UUID.randomUUID();
		jdbc.sql("""
				insert into ai_model (id, provider_id, model_name, display_name, context_window, tool_calling, vision,
				    reasoning, updated_by, updated_by_label)
				values (:id, :provider, 'luna', 'Luna', 200000, true, true, false, :by, 'operator@usage.test')
				""")
			.param("id", luna)
			.param("provider", router)
			.param("by", UUID.randomUUID())
			.update();
		for (int index = 0; index < 6; index++) {
			row(router, now.minusSeconds(60 + index), "document_reading", "9Router", "luna", "failed", 500, null, null,
					null, null, null, null, null);
		}

		// The task reads with that model: what fails is what runs now.
		jdbc.sql("update ai_task_model set model_id = :model where task = 'document_reading'").param("model", luna).update();
		assertThat(JsonPath.<Boolean>read(body(get(operator, "/overview").expectStatus().isOk()), "$.failing[0].assigned"))
			.isTrue();

		// An operator gave the task an OCR service: the failures are of what it used before.
		UUID service = provider("ocr", "AI Hay");
		jdbc.sql("update ai_task_model set model_id = null, ocr_provider_id = :ocr where task = 'document_reading'")
			.param("ocr", service)
			.update();
		assertThat(JsonPath.<Boolean>read(body(get(operator, "/overview").expectStatus().isOk()), "$.failing[0].assigned"))
			.isFalse();

		// And once the service fails in its turn, it is the one that runs.
		for (int index = 0; index < 7; index++) {
			row(service, now.minusSeconds(index), "document_reading", "AI Hay", "aihay", "failed", 500, null, null,
					null, null, null, null, null);
		}
		String both = body(get(operator, "/overview").expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(both, "$.failing[*].modelName")).containsExactly("aihay", "luna");
		assertThat(JsonPath.<List<Boolean>>read(both, "$.failing[*].assigned")).containsExactly(true, false);
	}

	@Test
	void theSeriesHasEveryHourOfTodayAndEveryDayOfALongerPeriod() {
		Instant now = Instant.now();
		calls(now, "matching", "gpt", 2, 1);
		calls(now.minus(Duration.ofDays(2)), "matching", "gpt", 3, 0);

		String today = body(get(operator, "/overview").expectStatus().isOk());
		int hours = now.atZone(VIETNAM).getHour() + 1;
		assertThat(JsonPath.<String>read(today, "$.seriesStep")).isEqualTo("hour");
		assertThat(JsonPath.<List<Object>>read(today, "$.series")).hasSize(hours);
		assertThat(JsonPath.<Integer>read(today, "$.series[-1].succeeded")).isEqualTo(2);
		assertThat(JsonPath.<Integer>read(today, "$.series[-1].failed")).isEqualTo(1);
		assertThat(Instant.parse(JsonPath.<String>read(today, "$.series[0].start")))
			.isEqualTo(now.atZone(VIETNAM).toLocalDate().atStartOfDay(VIETNAM).toInstant());

		String week = body(get(operator, "/overview?period=7d").expectStatus().isOk());
		assertThat(JsonPath.<String>read(week, "$.seriesStep")).isEqualTo("day");
		assertThat(JsonPath.<List<Integer>>read(week, "$.series[*].succeeded")).containsExactly(0, 0, 0, 0, 3, 0, 2);
		assertThat(JsonPath.<List<Integer>>read(week, "$.series[*].failed")).containsExactly(0, 0, 0, 0, 0, 0, 1);
	}

	@Test
	void theBreakdownGroupsByModelByTaskAndByProvider() {
		Instant now = Instant.now();
		calls(now, "matching", "gpt", 3, 1);
		calls(now, "document_reading", "gpt", 2, 0);
		ocr(now, "ok", null, "1.5");

		String byModel = body(get(operator, "/overview").expectStatus().isOk());
		assertThat(JsonPath.<String>read(byModel, "$.by")).isEqualTo("model");
		// A model on a provider for a task, the group with the most calls first.
		assertThat(JsonPath.<List<String>>read(byModel, "$.breakdown[*].task")).containsExactly("matching",
				"document_reading", "document_reading");
		assertThat(JsonPath.<List<String>>read(byModel, "$.breakdown[*].modelName")).containsExactly("gpt", "gpt", "aihay");
		assertThat(JsonPath.<Integer>read(byModel, "$.breakdown[0].calls")).isEqualTo(4);
		assertThat(JsonPath.<Integer>read(byModel, "$.breakdown[0].failed")).isEqualTo(1);
		assertThat(JsonPath.<Integer>read(byModel, "$.breakdown[0].averageDurationMs")).isEqualTo(1200);
		assertThat(JsonPath.<Object>read(byModel, "$.breakdown[0].estimatedCost")).isNull();
		assertThat(JsonPath.<Number>read(byModel, "$.breakdown[2].estimatedCost").doubleValue()).isCloseTo(0.0015,
				within(1e-9));

		String byTask = body(get(operator, "/overview?by=task").expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(byTask, "$.breakdown[*].task")).containsExactly("matching",
				"document_reading");
		assertThat(JsonPath.<List<Integer>>read(byTask, "$.breakdown[*].calls")).containsExactly(4, 3);
		assertThat(JsonPath.<Object>read(byTask, "$.breakdown[0].modelName")).isNull();

		String byProvider = body(get(operator, "/overview?by=provider").expectStatus().isOk());
		assertThat(JsonPath.<List<String>>read(byProvider, "$.breakdown[*].providerName")).containsExactly("9Router",
				"AI Hay");
		assertThat(JsonPath.<List<Integer>>read(byProvider, "$.breakdown[*].calls")).containsExactly(6, 1);
	}

	@Test
	void theLogIsNewestFirstInPagesAndNarrowedByItsFilters() {
		Instant now = Instant.now();
		for (int index = 0; index < 51; index++) {
			model(now.minusSeconds(100 + index), "matching", "gpt", "ok", null, 10L, 2L, null, "2", "10", null);
		}
		model(now.minusSeconds(2), "document_reading", "luna", "failed", 413, null, null, null, null, null, null);
		ocr(now.minusSeconds(1), "ok", null, "1.5");

		String first = body(get(operator, "/calls?period=7d").expectStatus().isOk());
		assertThat(JsonPath.<Integer>read(first, "$.total")).isEqualTo(53);
		assertThat(JsonPath.<Integer>read(first, "$.pageSize")).isEqualTo(50);
		assertThat(JsonPath.<List<Object>>read(first, "$.items")).hasSize(50);
		assertThat(JsonPath.<String>read(first, "$.items[0].modelName")).isEqualTo("aihay");
		assertThat(JsonPath.<String>read(first, "$.items[0].subjectType")).isEqualTo("solution_deck");
		assertThat(JsonPath.<Number>read(first, "$.items[0].estimatedCost").doubleValue()).isCloseTo(0.0015, within(1e-9));
		assertThat(JsonPath.<String>read(first, "$.items[1].outcome")).isEqualTo("failed");
		assertThat(JsonPath.<String>read(first, "$.items[1].failure")).isEqualTo("too_large");
		assertThat(JsonPath.<Integer>read(first, "$.items[1].errorStatus")).isEqualTo(413);
		assertThat(JsonPath.<Object>read(first, "$.items[1].estimatedCost")).isNull();
		assertThat(JsonPath.<Object>read(first, "$.items[2].failure")).isNull();
		// What was called in the period, to filter by.
		assertThat(JsonPath.<List<String>>read(first, "$.tasks")).containsExactly("document_reading", "matching");
		assertThat(JsonPath.<List<String>>read(first, "$.providers")).containsExactly("9Router", "AI Hay");
		assertThat(JsonPath.<List<String>>read(first, "$.models")).containsExactly("aihay", "gpt", "luna");

		assertThat(JsonPath.<List<Object>>read(body(get(operator, "/calls?period=7d&page=2").expectStatus().isOk()), "$.items"))
			.hasSize(3);
		assertThat(total("outcome=failed")).isEqualTo(1);
		assertThat(total("task=document_reading")).isEqualTo(2);
		assertThat(total("provider=AI Hay")).isEqualTo(1);
		assertThat(total("model=gpt&outcome=ok")).isEqualTo(51);
		assertThat(total("task=document_reading&model=luna&outcome=failed")).isEqualTo(1);

		assertProblem(get(operator, "/calls?period=year"), 400, "REQUEST_INVALID");
		assertProblem(get(operator, "/calls?page=0"), 400, "REQUEST_INVALID");
		assertProblem(get(operator, "/overview?by=person"), 400, "REQUEST_INVALID");
	}

	@Test
	void aFailedCallReadsAsWhatItsStatusOrItsExceptionSays() {
		assertThat(AiUsageReports.kind(401, null)).isEqualTo("key_refused");
		assertThat(AiUsageReports.kind(403, null)).isEqualTo("key_refused");
		assertThat(AiUsageReports.kind(429, null)).isEqualTo("rate_limited");
		assertThat(AiUsageReports.kind(413, null)).isEqualTo("too_large");
		assertThat(AiUsageReports.kind(400, null)).isEqualTo("request_refused");
		assertThat(AiUsageReports.kind(503, null)).isEqualTo("provider_failed");
		assertThat(AiUsageReports.kind(null, "com.openai.errors.OpenAIIoException")).isEqualTo("no_answer");
		assertThat(AiUsageReports.kind(null, "java.net.http.HttpTimeoutException")).isEqualTo("no_answer");
		// A row written before the status was kept.
		assertThat(AiUsageReports.kind(null, "com.openai.errors.UnexpectedStatusCodeException")).isEqualTo("failed");
	}

	/** How many calls of the last 7 days the filters keep. */
	private int total(String filters) {
		return JsonPath.<Integer>read(body(get(operator, "/calls?period=7d&" + filters).expectStatus().isOk()), "$.total");
	}

	/** Calls to a model without prices, each taking 1.2 seconds. */
	private void calls(Instant at, String task, String model, int succeeded, int failed) {
		for (int index = 0; index < succeeded; index++) {
			model(at, task, model, "ok", null, 10L, 2L, null, null, null, null);
		}
		for (int index = 0; index < failed; index++) {
			model(at, task, model, "failed", 500, null, null, null, null, null, null);
		}
	}

	private void model(Instant at, String task, String model, String outcome, @Nullable Integer status,
			@Nullable Long input, @Nullable Long output, @Nullable Long cacheRead, @Nullable String inputPrice,
			@Nullable String outputPrice, @Nullable String cachedPrice) {
		row(UUID.randomUUID(), at, task, "9Router", model, outcome, status, input, output, cacheRead, inputPrice, outputPrice, cachedPrice,
				null);
	}

	private void ocr(Instant at, String outcome, @Nullable Integer status, @Nullable String pricePerThousandCalls) {
		row(UUID.randomUUID(), at, "document_reading", "AI Hay", "aihay", outcome, status, null, null, null, null, null, null,
				pricePerThousandCalls);
	}

	/** A provider connected for chat or for OCR, as the Providers screen keeps one. */
	private UUID provider(String purpose, String name) {
		UUID id = UUID.randomUUID();
		jdbc.sql("""
				insert into ai_provider (id, purpose, name, base_url, adapter_type, updated_by, updated_by_label)
				values (:id, :purpose, :name, 'https://provider.test', 'openai', :by, 'operator@usage.test')
				""")
			.param("id", id)
			.param("purpose", purpose)
			.param("name", name)
			.param("by", UUID.randomUUID())
			.update();
		return id;
	}

	private void row(UUID providerId, Instant at, String task, String provider, String model, String outcome, @Nullable Integer status,
			@Nullable Long input, @Nullable Long output, @Nullable Long cacheRead, @Nullable String inputPrice,
			@Nullable String outputPrice, @Nullable String cachedPrice, @Nullable String pricePerThousandCalls) {
		jdbc.sql("""
				insert into ai_usage (id, occurred_at, task, provider_id, provider_name, model_name, input_tokens,
				    output_tokens, cache_read_tokens, duration_ms, outcome, error_type, error_status, subject_type,
				    subject_id, input_price, output_price, cached_input_price, price_per_1k_calls)
				values (:id, :at, :task, :providerId, :provider, :model, :input, :output, :cacheRead, 1200, :outcome,
				    :errorType, :status, 'solution_deck', 's-1', :inputPrice, :outputPrice, :cachedPrice, :perThousand)
				""")
			.param("id", UUID.randomUUID())
			.param("at", OffsetDateTime.ofInstant(at, ZoneOffset.UTC))
			.param("task", task)
			.param("providerId", providerId)
			.param("provider", provider)
			.param("model", model)
			.param("input", input)
			.param("output", output)
			.param("cacheRead", cacheRead)
			.param("outcome", outcome)
			.param("errorType", outcome.equals("failed") ? "com.openai.errors.UnexpectedStatusCodeException" : null)
			.param("status", status)
			.param("inputPrice", decimal(inputPrice))
			.param("outputPrice", decimal(outputPrice))
			.param("cachedPrice", decimal(cachedPrice))
			.param("perThousand", decimal(pricePerThousandCalls))
			.update();
	}

	private static @Nullable BigDecimal decimal(@Nullable String value) {
		return value == null ? null : new BigDecimal(value);
	}

	private RestTestClient.ResponseSpec get(String session, String path) {
		return client.get().uri(API + path).cookie(TestSignIn.SESSION_COOKIE, session).exchange();
	}

	private static String body(RestTestClient.ResponseSpec response) {
		return new String(response.expectBody().returnResult().getResponseBody(), UTF_8);
	}

	private static void assertProblem(RestTestClient.ResponseSpec response, int status, String code) {
		response.expectStatus()
			.isEqualTo(status)
			.expectHeader()
			.contentType(MediaType.APPLICATION_PROBLEM_JSON)
			.expectBody()
			.jsonPath("$.code")
			.isEqualTo(code);
	}

	/** The test mailbox, imported through a class of this test's own so that it keeps a database of its own. */
	@TestConfiguration(proxyBeanMethods = false)
	@Import(TestMailbox.Configuration.class)
	static class Mail {

	}

}
