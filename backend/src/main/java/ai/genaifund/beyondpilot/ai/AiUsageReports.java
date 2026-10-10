package ai.genaifund.beyondpilot.ai;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;

import ai.genaifund.beyondpilot.ai.dto.AiUsageCallListRequest;
import ai.genaifund.beyondpilot.ai.dto.AiUsageCallListResponse;
import ai.genaifund.beyondpilot.ai.dto.AiUsageOverviewRequest;
import ai.genaifund.beyondpilot.ai.dto.AiUsageOverviewResponse;
import ai.genaifund.beyondpilot.ai.persistence.AiUsageRepository;
import ai.genaifund.beyondpilot.ai.persistence.AiUsageRepository.By;
import ai.genaifund.beyondpilot.ai.persistence.AiUsageRepository.Filter;
import ai.genaifund.beyondpilot.ai.persistence.AiUsageRepository.Totals;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Admin › AI › Usage (BEY-104): what the calls to chat models and OCR services came to in a period, what is failing,
 * and the log of the calls. It only reads what {@link UsageRecorder} and {@link DocumentPages} recorded. Costs are
 * estimates from the prices kept with each call, and a call without a price is counted apart, never as free. Only an
 * operator reads it.
 */
@Service
public class AiUsageReports {

	/** The zone the screens show, so that "today" is the operator's day. */
	private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

	private static final int PAGE_SIZE = 50;

	/** What is failing is judged on the last day, whatever period the page shows: it says what is wrong now. */
	private static final Duration FAILING_WINDOW = Duration.ofHours(24);

	/** A task is failing on a model from this many failed calls, when they are this part of its calls. */
	private static final int FAILING_CALLS = 5;

	private static final int FAILING_PERCENT = 10;

	private final AiUsageRepository usage;

	private final IdentityService identity;

	AiUsageReports(AiUsageRepository usage, IdentityService identity) {
		this.usage = usage;
		this.identity = identity;
	}

	/**
	 * The Overview: totals, what is failing, the calls over time and where they went.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public AiUsageOverviewResponse overview(Actor actor, AiUsageOverviewRequest request) {
		identity.requireOperator(actor);
		String period = request.period() == null ? "today" : request.period();
		String by = request.by() == null ? "model" : request.by();
		Instant now = Instant.now();
		Instant from = start(period, now);
		boolean byHour = period.equals("today");

		Totals totals = usage.totals(from, now);
		return new AiUsageOverviewResponse(period,
				new AiUsageOverviewResponse.Totals(totals.calls(), totals.calls() - totals.failed(), totals.failed(),
						totals.inputTokens(), totals.outputTokens(), totals.cost(), totals.priced(), totals.unpriced()),
				usage.failing(now.minus(FAILING_WINDOW), now, FAILING_CALLS, FAILING_PERCENT)
					.stream()
					.map(failing -> new AiUsageOverviewResponse.Failing(failing.task(), failing.providerName(),
							failing.modelName(), failing.calls(), failing.failed(), failing.lastFailedAt(),
							kind(failing.errorStatus(), failing.errorType()), failing.assigned()))
					.toList(),
				byHour ? "hour" : "day",
				usage.series(from, now, byHour)
					.stream()
					.map(bucket -> new AiUsageOverviewResponse.Bucket(bucket.start(), bucket.succeeded(),
							bucket.failed()))
					.toList(),
				by,
				usage.breakdown(from, now, By.valueOf(by.toUpperCase(Locale.ROOT)))
					.stream()
					.map(group -> new AiUsageOverviewResponse.Group(group.modelName(), group.providerName(),
							group.task(), group.calls(), group.failed(), group.inputTokens(), group.outputTokens(),
							group.durationMs(), group.cost()))
					.toList());
	}

	/**
	 * One page of the log, newest first.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public AiUsageCallListResponse calls(Actor actor, AiUsageCallListRequest request) {
		identity.requireOperator(actor);
		Instant now = Instant.now();
		Instant from = start(request.period() == null ? "today" : request.period(), now);
		Filter filter = new Filter(from, now, request.task(), request.provider(), request.model(), request.outcome());
		int page = request.page() == null ? 1 : request.page();

		List<AiUsageCallListResponse.Item> items = usage.page(filter, PAGE_SIZE, (long) (page - 1) * PAGE_SIZE)
			.stream()
			.map(call -> new AiUsageCallListResponse.Item(call.id(), call.occurredAt(), call.task(),
					call.providerName(), call.modelName(), call.outcome(),
					call.outcome().equals("failed") ? kind(call.errorStatus(), call.errorType()) : null,
					call.errorStatus(), call.inputTokens(), call.outputTokens(), call.cacheReadTokens(),
					call.durationMs(), call.cost(), call.subjectType(), call.subjectId()))
			.toList();
		return new AiUsageCallListResponse(items, page, PAGE_SIZE, usage.count(filter),
				usage.named(from, now, By.TASK), usage.named(from, now, By.PROVIDER), usage.named(from, now, By.MODEL));
	}

	/** When a period starts: at midnight in Vietnam, today or 6 or 29 days before it. */
	private static Instant start(String period, Instant now) {
		LocalDate today = now.atZone(ZONE).toLocalDate();
		int daysBefore = switch (period) {
			case "7d" -> 6;
			case "30d" -> 29;
			default -> 0;
		};
		return today.minusDays(daysBefore).atStartOfDay(ZONE).toInstant();
	}

	/**
	 * What a failed call was, for a person: from the status the provider answered with, else from the class of the
	 * exception. Rows written before the status was kept have neither sign and read as {@code failed}.
	 */
	static String kind(@Nullable Integer status, @Nullable String errorType) {
		if (status == null) {
			String type = errorType == null ? "" : errorType.toLowerCase(Locale.ROOT);
			return type.contains("timeout") || type.endsWith("ioexception") ? "no_answer" : "failed";
		}
		if (status == 401 || status == 403) {
			return "key_refused";
		}
		if (status == 429) {
			return "rate_limited";
		}
		if (status == 413) {
			return "too_large";
		}
		if (status >= 500) {
			return "provider_failed";
		}
		return status >= 400 ? "request_refused" : "failed";
	}

}
