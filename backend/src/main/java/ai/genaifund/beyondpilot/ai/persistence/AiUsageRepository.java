package ai.genaifund.beyondpilot.ai.persistence;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * The record of what every call to a chat model or an OCR service took, and what Admin › AI › Usage reads from it.
 * Rows are only ever added.
 */
@Repository
public class AiUsageRepository {

	/**
	 * What a call would cost, in US dollars, at the prices kept with it; null for a call that failed and for one
	 * without a price. A service is billed by the call. A model is billed by the token: input tokens include those
	 * read from a cache, which cost the cached price where the model has one.
	 */
	private static final String COST = """
			case
			    when outcome <> 'ok' then null
			    when price_per_1k_calls is not null then price_per_1k_calls / 1000
			    when input_price is not null and output_price is not null and input_tokens is not null
			        and output_tokens is not null then (
			            (input_tokens - least(coalesce(cache_read_tokens, 0), input_tokens)) * input_price
			            + least(coalesce(cache_read_tokens, 0), input_tokens) * coalesce(cached_input_price, input_price)
			            + output_tokens * output_price) / 1000000
			end""";

	/** The calls of a period, each with its cost. */
	private static final String PRICED = "(select *, " + COST
			+ " as cost from ai_usage where occurred_at >= :from and occurred_at < :to) as call";

	private final JdbcClient jdbc;

	AiUsageRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/**
	 * Adds one call. It commits on its own, so the record stays whatever becomes of the caller's transaction.
	 * @param prices US dollars per million tokens, or per 1,000 calls for a service that bills by the call, as they
	 * were when the call was made
	 */
	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public void add(Call call) {
		jdbc.sql("""
				insert into ai_usage (id, occurred_at, task, provider_id, provider_name, model_name, input_tokens,
				    output_tokens, cache_read_tokens, cache_write_tokens, duration_ms, outcome, error_type,
				    error_status, subject_type, subject_id, input_price, output_price, cached_input_price,
				    price_per_1k_calls)
				values (:id, :occurredAt, :task, :providerId, :providerName, :modelName, :inputTokens, :outputTokens,
				    :cacheReadTokens, :cacheWriteTokens, :durationMs, :outcome, :errorType, :errorStatus, :subjectType,
				    :subjectId, :inputPrice, :outputPrice, :cachedInputPrice, :pricePerThousandCalls)
				""")
			.param("id", UUID.randomUUID())
			.param("occurredAt", Timestamp.from(call.occurredAt()))
			.param("task", call.task())
			.param("providerId", call.providerId())
			.param("providerName", call.providerName())
			.param("modelName", call.modelName())
			.param("inputTokens", call.inputTokens())
			.param("outputTokens", call.outputTokens())
			.param("cacheReadTokens", call.cacheReadTokens())
			.param("cacheWriteTokens", call.cacheWriteTokens())
			.param("durationMs", call.durationMs())
			.param("outcome", call.errorType() == null ? "ok" : "failed")
			.param("errorType", call.errorType())
			.param("errorStatus", call.errorStatus())
			.param("subjectType", call.subjectType())
			.param("subjectId", call.subjectId())
			.param("inputPrice", call.inputPrice())
			.param("outputPrice", call.outputPrice())
			.param("cachedInputPrice", call.cachedInputPrice())
			.param("pricePerThousandCalls", call.pricePerThousandCalls())
			.update();
	}

	/** What the calls of a period came to. */
	public Totals totals(Instant from, Instant to) {
		return period("""
				select count(*) as calls, count(*) filter (where outcome = 'failed') as failed,
				    coalesce(sum(input_tokens), 0)::bigint as input_tokens,
				    coalesce(sum(output_tokens), 0)::bigint as output_tokens, sum(cost) as cost, count(cost) as priced,
				    count(*) filter (where outcome = 'ok' and cost is null) as unpriced
				from\s""" + PRICED, from, to)
			.query((row, number) -> new Totals(row.getLong("calls"), row.getLong("failed"), row.getLong("input_tokens"),
					row.getLong("output_tokens"), row.getBigDecimal("cost"), row.getLong("priced"),
					row.getLong("unpriced")))
			.single();
	}

	/**
	 * The tasks that failed on a model in a period, the one with the most failures first, each with its last failure
	 * and whether the task still runs on that model or service.
	 * @param minFailed how many failed calls make a task failing
	 * @param minPercent and what part of its calls they must be, in percent
	 */
	public List<Failing> failing(Instant from, Instant to, int minFailed, int minPercent) {
		return period("""
				select u.task, u.provider_name, u.model_name, count(*) as calls,
				    count(*) filter (where u.outcome = 'failed') as failed,
				    max(u.occurred_at) filter (where u.outcome = 'failed') as last_failed_at,
				    (array_agg(u.error_status order by u.occurred_at desc) filter (where u.outcome = 'failed'))[1]
				        as error_status,
				    (array_agg(u.error_type order by u.occurred_at desc) filter (where u.outcome = 'failed'))[1]
				        as error_type,
				    coalesce(bool_or(t.task is not null), false) as assigned
				from ai_usage u
				    -- The task's reader today: its OCR provider, or the provider and the name of its model.
				    left join ai_task_model t on t.task = u.task
				        and (t.ocr_provider_id = u.provider_id
				            or exists (select 1 from ai_model m
				                where m.id = t.model_id and m.provider_id = u.provider_id
				                    and m.model_name = u.model_name))
				where u.occurred_at >= :from and u.occurred_at < :to
				group by u.task, u.provider_name, u.model_name
				having count(*) filter (where u.outcome = 'failed') >= :minFailed
				    and count(*) filter (where u.outcome = 'failed') * 100 >= count(*) * :minPercent
				order by failed desc, last_failed_at desc
				""", from, to)
			.param("minFailed", minFailed)
			.param("minPercent", minPercent)
			.query((row, number) -> new Failing(row.getString("task"), row.getString("provider_name"),
					row.getString("model_name"), row.getLong("calls"), row.getLong("failed"),
					row.getObject("last_failed_at", OffsetDateTime.class).toInstant(),
					row.getObject("error_status", Integer.class), row.getString("error_type"),
					row.getBoolean("assigned")))
			.list();
	}

	/**
	 * The calls of a period counted by hour or by day, an hour or a day without calls included.
	 * @param from the start of the first hour or day
	 */
	public List<Bucket> series(Instant from, Instant to, boolean byHour) {
		// The step is one of two constants, never what a caller sent.
		String step = byHour ? "interval '1 hour'" : "interval '1 day'";
		return period("""
				select bucket, count(*) filter (where u.outcome = 'ok') as succeeded,
				    count(*) filter (where u.outcome = 'failed') as failed
				from generate_series(:from, :to - interval '1 microsecond', %s) as bucket
				    left join ai_usage u on u.occurred_at >= bucket and u.occurred_at < bucket + %s
				        and u.occurred_at < :to
				group by bucket
				order by bucket
				""".formatted(step, step), from, to)
			.query((row, number) -> new Bucket(row.getObject("bucket", OffsetDateTime.class).toInstant(),
					row.getLong("succeeded"), row.getLong("failed")))
			.list();
	}

	/** Where the calls of a period went, the group with the most calls first. */
	public List<Group> breakdown(Instant from, Instant to, By by) {
		return period("""
				select %s, count(*) as calls, count(*) filter (where outcome = 'failed') as failed,
				    coalesce(sum(input_tokens), 0)::bigint as input_tokens,
				    coalesce(sum(output_tokens), 0)::bigint as output_tokens, avg(duration_ms)::bigint as duration_ms,
				    sum(cost) as cost
				from %s
				group by %s
				order by calls desc, %s
				""".formatted(by.select, PRICED, by.columns, by.columns), from, to)
			.query((row, number) -> new Group(row.getString("model_name"), row.getString("provider_name"),
					row.getString("task"), row.getLong("calls"), row.getLong("failed"), row.getLong("input_tokens"),
					row.getLong("output_tokens"), row.getLong("duration_ms"), row.getBigDecimal("cost")))
			.list();
	}

	/** One page of the calls the filter keeps, newest first. */
	public List<LoggedCall> page(Filter filter, int limit, long offset) {
		return filtered("""
				select id, occurred_at, task, provider_name, model_name, outcome, input_tokens, output_tokens,
				    cache_read_tokens, duration_ms, error_type, error_status, subject_type, subject_id,
				""" + COST + " as cost from ai_usage", filter, " order by occurred_at desc, id limit :limit offset :offset")
			.param("limit", limit)
			.param("offset", offset)
			.query((row, number) -> new LoggedCall(row.getObject("id", UUID.class),
					row.getObject("occurred_at", OffsetDateTime.class).toInstant(), row.getString("task"),
					row.getString("provider_name"), row.getString("model_name"), row.getString("outcome"),
					row.getObject("input_tokens", Long.class), row.getObject("output_tokens", Long.class),
					row.getObject("cache_read_tokens", Long.class), row.getLong("duration_ms"),
					row.getString("error_type"), row.getObject("error_status", Integer.class),
					row.getString("subject_type"), row.getString("subject_id"), row.getBigDecimal("cost")))
			.list();
	}

	/** How many calls the filter keeps. */
	public long count(Filter filter) {
		return filtered("select count(*) from ai_usage", filter, "").query(Long.class).single();
	}

	/** The tasks, providers or models that were called in a period, by name, to filter by. */
	public List<String> named(Instant from, Instant to, By by) {
		return period("select distinct %s from ai_usage where occurred_at >= :from and occurred_at < :to order by 1"
			.formatted(by.name), from, to).query(String.class).list();
	}

	private JdbcClient.StatementSpec period(String sql, Instant from, Instant to) {
		return jdbc.sql(sql)
			.param("from", OffsetDateTime.ofInstant(from, ZoneOffset.UTC))
			.param("to", OffsetDateTime.ofInstant(to, ZoneOffset.UTC));
	}

	private JdbcClient.StatementSpec filtered(String select, Filter filter, String tail) {
		List<String> where = new ArrayList<>(List.of("occurred_at >= :from", "occurred_at < :to"));
		if (filter.task() != null) {
			where.add("task = :task");
		}
		if (filter.providerName() != null) {
			where.add("provider_name = :provider");
		}
		if (filter.modelName() != null) {
			where.add("model_name = :model");
		}
		if (filter.outcome() != null) {
			where.add("outcome = :outcome");
		}
		JdbcClient.StatementSpec spec = period(select + " where " + String.join(" and ", where) + tail, filter.from(),
				filter.to());
		if (filter.task() != null) {
			spec = spec.param("task", filter.task());
		}
		if (filter.providerName() != null) {
			spec = spec.param("provider", filter.providerName());
		}
		if (filter.modelName() != null) {
			spec = spec.param("model", filter.modelName());
		}
		if (filter.outcome() != null) {
			spec = spec.param("outcome", filter.outcome());
		}
		return spec;
	}

	/** What a period's calls are grouped by. By model, a group is a model on a provider for a task. */
	public enum By {

		MODEL("model_name", "model_name, provider_name, task", "model_name, provider_name, task"),

		TASK("task", "null::text as model_name, null::text as provider_name, task", "task"),

		PROVIDER("provider_name", "null::text as model_name, provider_name, null::text as task", "provider_name");

		private final String name;

		private final String select;

		private final String columns;

		By(String name, String select, String columns) {
			this.name = name;
			this.select = select;
			this.columns = columns;
		}

	}

	/**
	 * What the calls of a period came to.
	 * @param cost the estimated cost of the calls with a known price, in US dollars; null when none has one
	 * @param priced how many calls the cost is computed from
	 * @param unpriced how many calls answered without a known price
	 */
	public record Totals(long calls, long failed, long inputTokens, long outputTokens, @Nullable BigDecimal cost,
			long priced, long unpriced) {
	}

	/**
	 * A task that failed on a model, with the status and the class of its last failure.
	 * @param assigned whether the task still runs on that model or service
	 */
	public record Failing(String task, String providerName, String modelName, long calls, long failed,
			Instant lastFailedAt, @Nullable Integer errorStatus, @Nullable String errorType, boolean assigned) {
	}

	/** The calls that started in one hour or one day. */
	public record Bucket(Instant start, long succeeded, long failed) {
	}

	/**
	 * The calls of one group. The names the grouping does not hold are null.
	 * @param cost null when no call of the group has a known price
	 */
	public record Group(@Nullable String modelName, @Nullable String providerName, @Nullable String task, long calls,
			long failed, long inputTokens, long outputTokens, long durationMs, @Nullable BigDecimal cost) {
	}

	/**
	 * A call as the record keeps it.
	 * @param cost the estimated cost in US dollars; null for a failed call and for one without a known price
	 */
	public record LoggedCall(UUID id, Instant occurredAt, String task, String providerName, String modelName,
			String outcome, @Nullable Long inputTokens, @Nullable Long outputTokens, @Nullable Long cacheReadTokens,
			long durationMs, @Nullable String errorType, @Nullable Integer errorStatus, @Nullable String subjectType,
			@Nullable String subjectId, @Nullable BigDecimal cost) {
	}

	/** Which calls to keep: those of a period, and of a task, provider, model or outcome where one is named. */
	public record Filter(Instant from, Instant to, @Nullable String task, @Nullable String providerName,
			@Nullable String modelName, @Nullable String outcome) {
	}

	/**
	 * One call to a chat model or an OCR service.
	 * @param inputTokens the whole input, the part read from or written to a cache included
	 * @param errorType the class of what went wrong; null for a call that answered
	 * @param errorStatus the HTTP status the provider answered a failed call with; null when it gave none
	 * @param pricePerThousandCalls what 1,000 calls cost in US dollars; null for a call billed by its tokens
	 */
	public record Call(Instant occurredAt, String task, UUID providerId, String providerName, String modelName,
			@Nullable Long inputTokens, @Nullable Long outputTokens, @Nullable Long cacheReadTokens,
			@Nullable Long cacheWriteTokens, long durationMs, @Nullable String errorType, @Nullable Integer errorStatus,
			@Nullable String subjectType, @Nullable String subjectId, @Nullable BigDecimal inputPrice,
			@Nullable BigDecimal outputPrice, @Nullable BigDecimal cachedInputPrice,
			@Nullable BigDecimal pricePerThousandCalls) {
	}

}
