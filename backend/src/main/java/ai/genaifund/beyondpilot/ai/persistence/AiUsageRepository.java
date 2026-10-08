package ai.genaifund.beyondpilot.ai.persistence;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** The record of what every call to a chat model took. Rows are only ever added. */
@Repository
public class AiUsageRepository {

	private final JdbcClient jdbc;

	AiUsageRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/**
	 * Adds one call. It commits on its own, so the record stays whatever becomes of the caller's transaction.
	 * @param prices US dollars per million tokens as they were when the call was made
	 */
	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public void add(Call call) {
		jdbc.sql("""
				insert into ai_usage (id, occurred_at, task, provider_id, provider_name, model_name, input_tokens,
				    output_tokens, cache_read_tokens, cache_write_tokens, duration_ms, outcome, error_type,
				    subject_type, subject_id, input_price, output_price, cached_input_price)
				values (:id, :occurredAt, :task, :providerId, :providerName, :modelName, :inputTokens, :outputTokens,
				    :cacheReadTokens, :cacheWriteTokens, :durationMs, :outcome, :errorType, :subjectType, :subjectId,
				    :inputPrice, :outputPrice, :cachedInputPrice)
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
			.param("subjectType", call.subjectType())
			.param("subjectId", call.subjectId())
			.param("inputPrice", call.inputPrice())
			.param("outputPrice", call.outputPrice())
			.param("cachedInputPrice", call.cachedInputPrice())
			.update();
	}

	/**
	 * One call to a chat model.
	 * @param errorType the class of what went wrong; null for a call that answered
	 */
	public record Call(Instant occurredAt, String task, UUID providerId, String providerName, String modelName,
			@Nullable Long inputTokens, @Nullable Long outputTokens, @Nullable Long cacheReadTokens,
			@Nullable Long cacheWriteTokens, long durationMs, @Nullable String errorType, @Nullable String subjectType,
			@Nullable String subjectId, @Nullable BigDecimal inputPrice, @Nullable BigDecimal outputPrice,
			@Nullable BigDecimal cachedInputPrice) {
	}

}
