package ai.genaifund.beyondpilot.ai;

import java.math.BigDecimal;
import java.util.UUID;

import ai.genaifund.beyondpilot.ai.adapter.ChatAdapter;
import ai.genaifund.beyondpilot.ai.adapter.ChatAdapterRegistry;
import ai.genaifund.beyondpilot.ai.adapter.ChatConnection;
import ai.genaifund.beyondpilot.ai.adapter.ChatModelOptions;
import ai.genaifund.beyondpilot.ai.persistence.AiModel;
import ai.genaifund.beyondpilot.ai.persistence.AiModelRepository;
import ai.genaifund.beyondpilot.ai.persistence.AiTaskModel;
import ai.genaifund.beyondpilot.ai.persistence.AiTaskModelRepository;
import ai.genaifund.beyondpilot.ai.persistence.AiUsageRepository;
import jakarta.annotation.PreDestroy;
import org.jspecify.annotations.Nullable;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Hands a task the chat model operators chose for it. The client is borrowed and every call through it is recorded;
 * nothing here falls back to a model nobody chose.
 */
@Service
public class AiModels {

	/** What a call an operator made to try a model is recorded as, where a task's name would be. */
	static final String MODEL_TEST = "model_test";

	private final AiTaskModelRepository tasks;

	private final AiModelRepository models;

	private final AiProviders providers;

	private final ChatAdapterRegistry adapters;

	private final AiUsageRepository usage;

	private final AiSettings settings;

	private final TransactionTemplate reads;

	private final ModelClients clients;

	private final Prices prices;

	AiModels(AiTaskModelRepository tasks, AiModelRepository models, AiProviders providers, ChatAdapterRegistry adapters,
			AiUsageRepository usage, AiSettings settings, TransactionTemplate transactions, Prices prices) {
		this.prices = prices;
		this.tasks = tasks;
		this.models = models;
		this.providers = providers;
		this.adapters = adapters;
		this.usage = usage;
		this.settings = settings;
		this.reads = new TransactionTemplate(transactions.getTransactionManager());
		this.reads.setReadOnly(true);
		this.clients = new ModelClients(settings.maxClients());
	}

	/**
	 * The chat client of a task. Close it when the work is done.
	 * @param subject what the calls are about, for the usage record; null when nothing in particular
	 * @throws AiException when no model is chosen for the task, its provider is switched off or has no readable key,
	 * or every client is in use
	 */
	public AiChat chat(AiTask task, @Nullable AiSubject subject) {
		// What the task uses is read first and the client built after, outside any transaction.
		Resolved resolved = reads.execute(status -> resolve(task));
		if (resolved == null) {
			throw new AiException(AiErrorCode.TASK_NOT_CONFIGURED, "Task " + task.value() + " has no usable model");
		}
		return chat(resolved, resolved.modelId() + ":" + resolved.effort().value(), task.value(), subject);
	}

	/**
	 * The chat client of one model, asked as its provider runs it by default, for an operator's test. Its calls are
	 * recorded as {@value #MODEL_TEST}.
	 * @throws AiException when the model is gone, or its provider is switched off or has no readable key
	 */
	AiChat probe(UUID modelId) {
		Resolved resolved = reads.execute(status -> {
			AiModel model = models.findById(modelId)
				.orElseThrow(() -> new AiException(AiErrorCode.MODEL_NOT_FOUND, "No model " + modelId));
			return resolve(model, null);
		});
		if (resolved == null) {
			throw new AiException(AiErrorCode.MODEL_UNAVAILABLE, "Model " + modelId + " has no usable provider");
		}
		return chat(resolved, resolved.modelId() + ":test", MODEL_TEST, null);
	}

	private AiChat chat(Resolved resolved, String key, String recordedAs, @Nullable AiSubject subject) {
		ModelClients.Lease lease = clients.acquire(key, resolved.revision(), () -> connect(resolved));
		ChatClient client = ChatClient.builder(lease.model())
			.defaultAdvisors(new UsageRecorder(usage, resolved.used(), recordedAs, subject))
			.build();
		return new AiChat(client, resolved.modelName(), lease::close);
	}

	/** Whether a task can run now: a model is chosen and its provider is switched on with a key. */
	public boolean available(AiTask task) {
		return reads.execute(status -> resolve(task)) != null;
	}

	private @Nullable Resolved resolve(AiTask task) {
		AiTaskModel row = tasks.findById(task.value()).orElse(null);
		UUID modelId = row == null ? null : row.getModelId();
		AiModel model = modelId == null ? null : models.findById(modelId).orElse(null);
		if (row == null || model == null) {
			return null;
		}
		return resolve(model, AiAdministration.effort(task, row));
	}

	/** @param effort how hard to reason; null leaves the level to the provider */
	private @Nullable Resolved resolve(AiModel model, @Nullable ReasoningEffort effort) {
		AiProviderView provider = providers.get(AiProviders.CHAT, model.getProviderId());
		AiConnection connection = providers.connection(AiProviders.CHAT, provider.id()).orElse(null);
		if (!provider.enabled() || connection == null) {
			return null;
		}
		Prices.OfModel price = prices.of(model);
		return new Resolved(model.getId(), model.getModelName(), model.getMaxOutputTokens(),
				effort != null && model.isReasoning(), effort == null ? ReasoningEffort.OFF : effort, provider.id(), provider.name(), connection.adapterType(),
				connection.baseUrl(), connection.apiKey(), provider.version() + ":" + model.getVersion(),
				price.input(), price.output(), price.cachedInput());
	}

	private ChatModel connect(Resolved resolved) {
		ChatAdapter adapter = adapters.adapter(resolved.adapterType())
			.orElseThrow(() -> new AiException(AiErrorCode.TASK_NOT_CONFIGURED,
					"No adapter of type " + resolved.adapterType()));
		return adapter.connect(new ChatConnection(resolved.baseUrl(), resolved.apiKey()), resolved.modelName(),
				new ChatModelOptions(resolved.maxOutputTokens(), resolved.reasons(), resolved.effort(),
						settings.callTimeout()));
	}

	@PreDestroy
	void close() {
		clients.close();
	}

	/**
	 * What a task uses, read at one moment. It holds the key in clear for as long as a client is being built.
	 * @param revision changes whenever the provider or the model is saved, which retires the client built before
	 */
	record Resolved(UUID modelId, String modelName, @Nullable Integer maxOutputTokens, boolean reasons,
			ReasoningEffort effort, UUID providerId, String providerName, String adapterType, String baseUrl,
			String apiKey, String revision, @Nullable BigDecimal inputPrice, @Nullable BigDecimal outputPrice,
			@Nullable BigDecimal cachedInputPrice) {

		/** What the usage record keeps of it: no key. */
		Used used() {
			return new Used(providerId, providerName, modelName, inputPrice, outputPrice, cachedInputPrice);
		}

		@Override
		public String toString() {
			return "Resolved[" + modelId + ", redacted]";
		}

	}

	/** The provider and model a call went to, and the model's prices then, in US dollars per million tokens. */
	record Used(UUID providerId, String providerName, String modelName, @Nullable BigDecimal inputPrice,
			@Nullable BigDecimal outputPrice, @Nullable BigDecimal cachedInputPrice) {
	}

}
