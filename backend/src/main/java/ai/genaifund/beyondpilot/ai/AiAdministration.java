package ai.genaifund.beyondpilot.ai;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import ai.genaifund.beyondpilot.ai.adapter.ChatAdapter;
import ai.genaifund.beyondpilot.ai.adapter.ChatAdapterRegistry;
import ai.genaifund.beyondpilot.ai.adapter.ChatConnection;
import ai.genaifund.beyondpilot.ai.adapter.ChatEndpoints;
import ai.genaifund.beyondpilot.ai.adapter.ChatProviderException;
import ai.genaifund.beyondpilot.ai.adapter.ReportedModel;
import ai.genaifund.beyondpilot.ai.dto.AddChatModelsRequest;
import ai.genaifund.beyondpilot.ai.dto.ChatModelTestResponse;
import ai.genaifund.beyondpilot.ai.dto.ChatProviderTestResponse;
import ai.genaifund.beyondpilot.ai.dto.ChatSettingsResponse;
import ai.genaifund.beyondpilot.ai.dto.ProbeChatProviderRequest;
import ai.genaifund.beyondpilot.ai.dto.ReportedChatModelsResponse;
import ai.genaifund.beyondpilot.ai.dto.SaveChatModelRequest;
import ai.genaifund.beyondpilot.ai.dto.SaveChatProviderRequest;
import ai.genaifund.beyondpilot.ai.dto.SetTaskModelRequest;
import ai.genaifund.beyondpilot.ai.persistence.AiModel;
import ai.genaifund.beyondpilot.ai.persistence.AiModelRepository;
import ai.genaifund.beyondpilot.ai.persistence.AiTaskModel;
import ai.genaifund.beyondpilot.ai.persistence.AiTaskModelRepository;
import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Operator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * What operators do in the Chat tab of Admin › AI › Providers: connect chat providers, enable their models and choose
 * the model each task uses. It follows MemoryOS's model catalog, kept smaller: no groups, no per-member choice, no
 * budgets.
 *
 * <p>
 * A call to a provider is never made inside a database transaction.
 */
@Service
public class AiAdministration {

	private static final Logger LOG = LoggerFactory.getLogger(AiAdministration.class);

	private final IdentityService identity;

	private final AiProviders providers;

	private final AiModelRepository models;

	private final AiTaskModelRepository tasks;

	private final ChatAdapterRegistry adapters;

	private final KnownModels known;

	private final AiSettings settings;

	private final AiModels chatModels;

	private final AuditTrail audit;

	AiAdministration(IdentityService identity, AiProviders providers, AiModelRepository models,
			AiTaskModelRepository tasks, ChatAdapterRegistry adapters, KnownModels known, AiSettings settings,
			AiModels chatModels, AuditTrail audit) {
		this.identity = identity;
		this.providers = providers;
		this.models = models;
		this.tasks = tasks;
		this.adapters = adapters;
		this.known = known;
		this.settings = settings;
		this.chatModels = chatModels;
		this.audit = audit;
	}

	/**
	 * The chat providers with their models, and the model each task uses.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public ChatSettingsResponse chat(Actor actor) {
		identity.requireOperator(actor);
		return response();
	}

	/**
	 * Connects a chat provider.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws AiException when the adapter is unknown, the address is not valid, the name is taken, the key is missing,
	 * or the server has no key to seal it
	 */
	@Transactional
	public ChatSettingsResponse connectProvider(Actor actor, SaveChatProviderRequest request) {
		Operator operator = identity.requireOperator(actor);
		providers.connect(operator, AiProviders.CHAT, change(request));
		return response();
	}

	/**
	 * Changes a chat provider: its name, its address, its key, or whether it is switched on.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws AiException when the provider is gone or changed meanwhile, the adapter is unknown, the address is not
	 * valid, the name is taken, or the key is kept for a new address
	 */
	@Transactional
	public ChatSettingsResponse changeProvider(Actor actor, UUID id, SaveChatProviderRequest request) {
		Operator operator = identity.requireOperator(actor);
		providers.change(operator, AiProviders.CHAT, id, change(request));
		return response();
	}

	/**
	 * Removes a chat provider with its key and its models. The tasks that used one of them become unset.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws AiException when the provider is gone
	 */
	@Transactional
	public ChatSettingsResponse removeProvider(Actor actor, UUID id) {
		Operator operator = identity.requireOperator(actor);
		providers.remove(operator, AiProviders.CHAT, id);
		return response();
	}

	/**
	 * Tries a connection, saved or not, by listing the provider's models. No tokens are spent and nothing is stored.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws AiException when the adapter is unknown, the address is not valid, or no key is given and the saved one
	 * cannot be used for this address
	 */
	@Transactional(propagation = Propagation.NOT_SUPPORTED)
	public ChatProviderTestResponse testProvider(Actor actor, ProbeChatProviderRequest request) {
		identity.requireOperator(actor);
		ChatAdapter adapter = adapter(request.adapterType());
		ChatConnection connection = connection(request);
		long started = System.nanoTime();
		try {
			int count = adapter.reportedModels(connection, settings.listTimeout()).size();
			return new ChatProviderTestResponse(true, count, millisSince(started), null);
		}
		catch (ChatProviderException failed) {
			logFailure(failed);
			return new ChatProviderTestResponse(false, null, millisSince(started), reason(failed));
		}
	}

	/**
	 * Asks an enabled model one line, to prove it answers. The call spends a few tokens and is recorded.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws AiException when the model is gone, its provider is switched off or has no key, or every client is in use
	 */
	@Transactional(propagation = Propagation.NOT_SUPPORTED)
	public ChatModelTestResponse testModel(Actor actor, UUID id) {
		identity.requireOperator(actor);
		long started = System.nanoTime();
		try (AiChat chat = chatModels.probe(id)) {
			String answer = chat.client().prompt().user("Reply OK.").call().content();
			return new ChatModelTestResponse(answer != null && !answer.isBlank(), millisSince(started));
		}
		catch (AiException refused) {
			throw refused;
		}
		catch (RuntimeException failed) {
			// What the provider said can repeat the request, so only the kind of failure is kept.
			LOG.atInfo()
				.addKeyValue("event", "ai.model.test_failed")
				.addKeyValue("error_type", failed.getClass().getName())
				.log("A chat model did not answer its test");
			return new ChatModelTestResponse(false, millisSince(started));
		}
	}

	/**
	 * The models a provider lists, saved or not, with what it and the catalog know about each.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws AiException when the adapter is unknown, the address is not valid, no usable key is given, the key is
	 * refused, the provider cannot be reached, or its answer is not its API's
	 */
	@Transactional(propagation = Propagation.NOT_SUPPORTED)
	public ReportedChatModelsResponse reportedModels(Actor actor, ProbeChatProviderRequest request) {
		identity.requireOperator(actor);
		ChatAdapter adapter = adapter(request.adapterType());
		ChatConnection connection = connection(request);
		List<ReportedModel> reported;
		try {
			reported = adapter.reportedModels(connection, settings.listTimeout());
		}
		catch (ChatProviderException failed) {
			logFailure(failed);
			throw new AiException(switch (failed.failure()) {
				case CREDENTIAL_REJECTED -> AiErrorCode.PROVIDER_CREDENTIAL_REJECTED;
				case UNREACHABLE -> AiErrorCode.PROVIDER_UNREACHABLE;
				case INCOMPATIBLE -> AiErrorCode.PROVIDER_INCOMPATIBLE;
			}, "Listing the models of a " + request.adapterType() + " provider failed: " + failed.failure());
		}
		Set<String> configured = request.providerId() == null ? Set.of()
				: models.findByProviderIdInOrderByModelName(List.of(request.providerId()))
					.stream()
					.map(AiModel::getModelName)
					.collect(Collectors.toSet());
		return new ReportedChatModelsResponse(reported.stream()
			.map(model -> ModelSpecs.of(model, known.find(model.modelName()).orElse(null)))
			.sorted((a, b) -> a.modelName().compareToIgnoreCase(b.modelName()))
			.map(spec -> new ReportedChatModelsResponse.Model(spec.modelName(), spec.contextWindow(),
					spec.maxOutputTokens(), spec.toolCalling(), spec.vision(), spec.reasoning(),
					spec.pricing() == null ? null : spec.pricing().input(),
					spec.pricing() == null ? null : spec.pricing().output(),
					spec.pricing() == null ? null : spec.pricing().cachedInput(), spec.source(),
					configured.contains(spec.modelName())))
			.toList());
	}

	/**
	 * Enables models on a provider, as ticked in its list.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws AiException when the provider is gone, a model is already there, or a limit is not valid
	 */
	@Transactional
	public ChatSettingsResponse addModels(Actor actor, UUID providerId, AddChatModelsRequest request) {
		Operator operator = identity.requireOperator(actor);
		AiProviderView provider = providers.get(AiProviders.CHAT, providerId);
		Instant now = Instant.now();
		for (SaveChatModelRequest each : request.models()) {
			String name = each.modelName().strip();
			if (models.existsByProviderIdAndModelName(providerId, name)) {
				throw new AiException(AiErrorCode.MODEL_NAME_TAKEN, "Provider " + providerId + " already has " + name);
			}
			AiModel model = new AiModel(providerId, name);
			describe(model, each);
			model.changedBy(operator.accountId(), operator.label(), now);
			try {
				models.saveAndFlush(model);
			}
			catch (DataIntegrityViolationException raced) {
				throw new AiException(AiErrorCode.MODEL_NAME_TAKEN, "Provider " + providerId + " already has " + name);
			}
			record(AuditAction.AI_MODEL_ADD, operator, model, provider.name());
		}
		return response();
	}

	/**
	 * Corrects what is known about a model: its limits, capabilities and prices.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws AiException when the model is gone or changed meanwhile, or a limit is not valid
	 */
	@Transactional
	public ChatSettingsResponse changeModel(Actor actor, UUID id, SaveChatModelRequest request) {
		Operator operator = identity.requireOperator(actor);
		AiModel model = model(id);
		if (model.getVersion() != request.version()) {
			throw new AiException(AiErrorCode.MODEL_CHANGED,
					"Model " + id + " read at version " + request.version() + ", now " + model.getVersion());
		}
		describe(model, request);
		model.changedBy(operator.accountId(), operator.label(), Instant.now());
		try {
			models.saveAndFlush(model);
		}
		catch (ObjectOptimisticLockingFailureException raced) {
			throw new AiException(AiErrorCode.MODEL_CHANGED, "Model " + id + " changed while it was saved");
		}
		record(AuditAction.AI_MODEL_UPDATE, operator, model,
				providers.get(AiProviders.CHAT, model.getProviderId()).name());
		return response();
	}

	/**
	 * Removes a model from its provider. A task that used it becomes unset.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws AiException when the model is gone
	 */
	@Transactional
	public ChatSettingsResponse removeModel(Actor actor, UUID id) {
		Operator operator = identity.requireOperator(actor);
		AiModel model = model(id);
		String provider = providers.get(AiProviders.CHAT, model.getProviderId()).name();
		models.delete(model);
		models.flush();
		record(AuditAction.AI_MODEL_REMOVE, operator, model, provider);
		return response();
	}

	/**
	 * Chooses the model a task uses, and how hard it reasons. The choice is saved at once.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws AiException when the task is unknown or changed meanwhile, the model is gone, or its provider is
	 * switched off or has no key
	 */
	@Transactional
	public ChatSettingsResponse setTaskModel(Actor actor, String task, SetTaskModelRequest request) {
		Operator operator = identity.requireOperator(actor);
		AiTask named = AiTask.of(task).orElseThrow(() -> new AiException(AiErrorCode.TASK_UNKNOWN, "No task " + task));
		AiTaskModel row = tasks.findById(named.value())
			.orElseThrow(() -> new AiException(AiErrorCode.TASK_UNKNOWN, "No row for task " + task));
		if (row.getVersion() != request.version()) {
			throw new AiException(AiErrorCode.TASK_CHANGED,
					"Task " + task + " read at version " + request.version() + ", now " + row.getVersion());
		}
		String modelName = "none";
		if (request.modelId() != null) {
			AiModel model = model(request.modelId());
			AiProviderView provider = providers.get(AiProviders.CHAT, model.getProviderId());
			if (!provider.enabled() || !provider.hasKey()) {
				throw new AiException(AiErrorCode.MODEL_UNAVAILABLE,
						"Provider " + provider.id() + " of model " + model.getId() + " is off or has no key");
			}
			if (named.readsImages() && !model.isVision()) {
				throw new AiException(AiErrorCode.MODEL_WITHOUT_VISION,
						"Task " + task + " sends pictures and model " + model.getId() + " does not read them");
			}
			modelName = model.getModelName();
		}
		row.use(request.modelId(), request.reasoningEffort(), operator.accountId(), operator.label(), Instant.now());
		try {
			tasks.saveAndFlush(row);
		}
		catch (ObjectOptimisticLockingFailureException raced) {
			throw new AiException(AiErrorCode.TASK_CHANGED, "Task " + task + " changed while it was saved");
		}
		audit.record(new AuditRecord(AuditAction.AI_TASK_MODEL_CHANGE, actorOf(operator),
				new AuditRecord.Resource("ai_task", named.value(), named.value()),
				Map.of("model", modelName, "reasoning", effort(named, row).value())));
		return response();
	}

	private ChatSettingsResponse response() {
		List<AiProviderView> all = providers.list(AiProviders.CHAT);
		List<AiModel> allModels = all.isEmpty() ? List.of()
				: models.findByProviderIdInOrderByModelName(all.stream().map(AiProviderView::id).toList());
		List<AiTaskModel> rows = tasks.findAll();
		Set<UUID> chosen = rows.stream().map(AiTaskModel::getModelId).filter(Objects::nonNull).collect(Collectors.toSet());
		List<ChatSettingsResponse.Provider> shown = new ArrayList<>();
		for (AiProviderView provider : all) {
			List<AiModel> own = allModels.stream().filter(m -> m.getProviderId().equals(provider.id())).toList();
			shown.add(new ChatSettingsResponse.Provider(provider.id(), provider.name(), provider.adapterType(),
					provider.baseUrl(), provider.enabled(), provider.hasKey(),
					own.stream().anyMatch(m -> chosen.contains(m.getId())), provider.updatedBy(), provider.updatedAt(),
					provider.version(),
					own.stream()
						.map(m -> new ChatSettingsResponse.Model(m.getId(), m.getModelName(), m.getDisplayName(),
								m.getContextWindow(), m.getMaxOutputTokens(), m.isToolCalling(), m.isVision(),
								m.isReasoning(), m.getInputPrice(), m.getOutputPrice(), m.getCachedInputPrice(),
								m.getVersion()))
						.toList()));
		}
		List<ChatSettingsResponse.Task> taskRows = new ArrayList<>();
		for (AiTask task : AiTask.values()) {
			AiTaskModel row = rows.stream().filter(r -> r.getTask().equals(task.value())).findFirst().orElse(null);
			UUID modelId = row == null ? null : row.getModelId();
			AiModel model = modelId == null ? null
					: allModels.stream().filter(m -> m.getId().equals(modelId)).findFirst().orElse(null);
			AiProviderView provider = model == null ? null
					: all.stream().filter(p -> p.id().equals(model.getProviderId())).findFirst().orElse(null);
			boolean available = provider != null && provider.enabled() && provider.hasKey();
			taskRows.add(new ChatSettingsResponse.Task(task.value(), model == null ? null : model.getId(),
					(row == null ? task.defaultEffort() : effort(task, row)).value(), available,
					row == null ? 0 : row.getVersion()));
		}
		return new ChatSettingsResponse(providers.keysCanBeStored(), adapters.types(), shown, taskRows);
	}

	/** A provider as the editor holds it, once its adapter is known and its address is one a provider may have. */
	private AiProviderChange change(SaveChatProviderRequest request) {
		adapter(request.adapterType());
		String baseUrl = endpoint(request.baseUrl());
		AiProviderChange.Key key = switch (request.key()) {
			case "replace" -> AiProviderChange.Key.REPLACE;
			case "remove" -> AiProviderChange.Key.REMOVE;
			default -> AiProviderChange.Key.KEEP;
		};
		return new AiProviderChange(null, request.adapterType(), request.name(), baseUrl, request.enabled(), key,
				request.apiKey(), request.version());
	}

	/** The connection to try: the key typed, or the saved one for the address it was given for. */
	private ChatConnection connection(ProbeChatProviderRequest request) {
		String baseUrl = endpoint(request.baseUrl());
		String key = request.apiKey() == null || request.apiKey().isBlank()
				? providers.savedKey(AiProviders.CHAT, request.providerId(), baseUrl) : request.apiKey().strip();
		return new ChatConnection(baseUrl, key);
	}

	private ChatAdapter adapter(String type) {
		return adapters.adapter(type)
			.orElseThrow(() -> new AiException(AiErrorCode.PROVIDER_ADAPTER_UNKNOWN, "No adapter of type " + type));
	}

	private AiModel model(UUID id) {
		return models.findById(id).orElseThrow(() -> new AiException(AiErrorCode.MODEL_NOT_FOUND, "No model " + id));
	}

	private static void describe(AiModel model, SaveChatModelRequest request) {
		Integer output = request.maxOutputTokens();
		if (output != null && output >= request.contextWindow()) {
			throw new AiException(AiErrorCode.MODEL_INVALID, "An answer limit of " + output
					+ " does not fit a context window of " + request.contextWindow());
		}
		String shown = request.displayName() == null || request.displayName().isBlank() ? request.modelName().strip()
				: request.displayName().strip();
		model.describe(shown, request.contextWindow(), output, request.toolCalling(), request.vision(),
				request.reasoning(), request.inputPrice(), request.outputPrice(), request.cachedInputPrice());
	}

	private void record(AuditAction action, Operator operator, AiModel model, String provider) {
		audit.record(new AuditRecord(action, actorOf(operator),
				new AuditRecord.Resource("ai_model", model.getId().toString(), model.getModelName()),
				Map.of("provider", provider)));
	}

	/** How hard a task reasons: what an operator set, else the task's own default. */
	static ReasoningEffort effort(AiTask task, AiTaskModel row) {
		String set = row.getReasoningEffort();
		return set == null ? task.defaultEffort() : ReasoningEffort.of(set).orElse(task.defaultEffort());
	}

	private static String endpoint(String baseUrl) {
		String text = baseUrl.strip();
		if (!ChatEndpoints.valid(text)) {
			// The address is not repeated: a query or a user part can carry a secret.
			throw new AiException(AiErrorCode.PROVIDER_ENDPOINT_INVALID,
					"Not an address a provider may have (" + text.length() + " characters)");
		}
		return text;
	}

	private static String reason(ChatProviderException failed) {
		return switch (failed.failure()) {
			case CREDENTIAL_REJECTED -> "rejected";
			case UNREACHABLE -> "unreachable";
			case INCOMPATIBLE -> "incompatible";
		};
	}

	private static void logFailure(ChatProviderException failed) {
		LOG.atInfo()
			.addKeyValue("event", "ai.provider.list_failed")
			.addKeyValue("error_type", failed.getClass().getName())
			.addKeyValue("error_code", failed.failure().name())
			.log("A chat provider did not list its models");
	}

	private static long millisSince(long started) {
		return (System.nanoTime() - started) / 1_000_000;
	}

	private static AuditRecord.Actor actorOf(Operator operator) {
		return new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email());
	}

}
