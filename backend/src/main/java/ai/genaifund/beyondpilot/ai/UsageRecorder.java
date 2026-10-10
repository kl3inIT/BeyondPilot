package ai.genaifund.beyondpilot.ai;

import java.time.Instant;

import ai.genaifund.beyondpilot.ai.persistence.AiUsageRepository;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClientRequest;
import org.springframework.ai.chat.client.ChatClientResponse;
import org.springframework.ai.chat.client.advisor.api.CallAdvisor;
import org.springframework.ai.chat.client.advisor.api.CallAdvisorChain;
import org.springframework.ai.chat.metadata.Usage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.core.Ordered;

/**
 * Records every call a task's chat client makes: its tokens as Spring AI's {@link Usage} reports them, how long it
 * took, whether it answered, and the model's prices then. It wraps the whole chain, so callers record nothing
 * themselves. No prompt and no answer is kept, and a record that cannot be written never fails the call.
 *
 * <p>
 * The input recorded is the whole input. OpenAI counts the part read from a cache inside its prompt tokens; Anthropic
 * reports it, and the part written to a cache, beside them, so they are added here.
 */
final class UsageRecorder implements CallAdvisor {

	private static final Logger LOG = LoggerFactory.getLogger(UsageRecorder.class);

	private final AiUsageRepository usage;

	private final AiModels.Used used;

	private final String task;

	private final @Nullable AiSubject subject;

	UsageRecorder(AiUsageRepository usage, AiModels.Used used, String task, @Nullable AiSubject subject) {
		this.usage = usage;
		this.used = used;
		this.task = task;
		this.subject = subject;
	}

	@Override
	public String getName() {
		return "ai-usage";
	}

	/** Outermost, so the time and the outcome are those of the whole call. */
	@Override
	public int getOrder() {
		return Ordered.HIGHEST_PRECEDENCE;
	}

	@Override
	public ChatClientResponse adviseCall(ChatClientRequest request, CallAdvisorChain chain) {
		Instant started = Instant.now();
		long clock = System.nanoTime();
		try {
			ChatClientResponse response = chain.nextCall(request);
			ChatResponse answer = response.chatResponse();
			record(started, clock, answer == null ? null : answer.getMetadata().getUsage(), null, null);
			return response;
		}
		catch (RuntimeException failure) {
			record(started, clock, null, failure.getClass().getName(), ProviderFailures.status(failure));
			throw failure;
		}
	}

	private void record(Instant started, long clock, @Nullable Usage tokens, @Nullable String errorType,
			@Nullable Integer errorStatus) {
		try {
			usage.add(new AiUsageRepository.Call(started, task, used.providerId(), used.providerName(),
					used.modelName(), tokens == null ? null : input(tokens),
					tokens == null ? null : count(tokens.getCompletionTokens()),
					tokens == null ? null : tokens.getCacheReadInputTokens(),
					tokens == null ? null : tokens.getCacheWriteInputTokens(), (System.nanoTime() - clock) / 1_000_000,
					errorType, errorStatus, subject == null ? null : subject.type(),
					subject == null ? null : subject.id(),
					used.inputPrice(), used.outputPrice(), used.cachedInputPrice(), null));
		}
		catch (RuntimeException unwritten) {
			LOG.atWarn()
				.addKeyValue("event", "ai.usage.not_recorded")
				.addKeyValue("error_type", unwritten.getClass().getName())
				.log("A call to a chat model was not recorded");
		}
	}

	private static @Nullable Long input(Usage tokens) {
		Long prompt = count(tokens.getPromptTokens());
		if (prompt == null || !(tokens.getNativeUsage() instanceof com.anthropic.models.messages.Usage)) {
			return prompt;
		}
		return prompt + orZero(tokens.getCacheReadInputTokens()) + orZero(tokens.getCacheWriteInputTokens());
	}

	private static long orZero(@Nullable Long tokens) {
		return tokens == null ? 0 : tokens;
	}

	private static @Nullable Long count(@Nullable Integer tokens) {
		return tokens == null ? null : Long.valueOf(tokens);
	}

}
