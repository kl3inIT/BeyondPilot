package ai.genaifund.beyondpilot.search;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import ai.genaifund.beyondpilot.ai.AiConnection;
import ai.genaifund.beyondpilot.ai.AiException;
import ai.genaifund.beyondpilot.ai.AiProviderChange;
import ai.genaifund.beyondpilot.ai.AiProviderView;
import ai.genaifund.beyondpilot.ai.AiProviders;
import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Operator;
import ai.genaifund.beyondpilot.search.dto.AiProviderTestResponse;
import ai.genaifund.beyondpilot.search.dto.AiProvidersResponse;
import ai.genaifund.beyondpilot.search.dto.ChooseEmbeddingModelRequest;
import ai.genaifund.beyondpilot.search.dto.RetriedEmbeddingsResponse;
import ai.genaifund.beyondpilot.search.dto.RetryEmbeddingsRequest;
import ai.genaifund.beyondpilot.search.dto.SaveAiProviderRequest;
import ai.genaifund.beyondpilot.search.dto.SearchIndexResponse;
import ai.genaifund.beyondpilot.search.dto.SetSemanticSearchRequest;
import ai.genaifund.beyondpilot.search.dto.TestAiProviderRequest;
import ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository;
import ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository.KindStatus;
import ai.genaifund.beyondpilot.search.persistence.SearchSettings;
import ai.genaifund.beyondpilot.search.persistence.SearchSettingsRepository;
import org.jspecify.annotations.Nullable;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * What operators do in Admin › AI for search: connect the providers it embeds with, choose its model, turn semantic
 * search on or off, and look after the index. The providers and their keys are kept by the {@code ai} module; this
 * service decides what an embedding provider's address and model may be, and words a refusal in search's own codes.
 */
@Service
public class SearchAdministration {

	/** How many held-back items the Search index screen lists. */
	private static final int HELD_BACK_SHOWN = 50;

	private final IdentityService identity;

	private final AiProviders providers;

	private final SearchSettingsRepository settings;

	private final SearchDocumentRepository index;

	private final OpenAiEmbeddings openAi;

	private final EmbeddingClients clients;

	private final SearchEmbeddings embeddings;

	private final IndexRepair repair;

	private final AuditTrail audit;

	SearchAdministration(IdentityService identity, AiProviders providers, SearchSettingsRepository settings,
			SearchDocumentRepository index, OpenAiEmbeddings openAi, EmbeddingClients clients,
			SearchEmbeddings embeddings, IndexRepair repair, AuditTrail audit) {
		this.identity = identity;
		this.providers = providers;
		this.settings = settings;
		this.index = index;
		this.openAi = openAi;
		this.clients = clients;
		this.embeddings = embeddings;
		this.repair = repair;
		this.audit = audit;
	}

	/**
	 * The embedding providers and the model in use, as the Providers screen shows them.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public AiProvidersResponse providers(Actor actor) {
		identity.requireOperator(actor);
		return providersResponse();
	}

	/**
	 * Connects a provider.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws SearchException when the address is not valid, the name is taken, the key is missing, or the server has
	 * no key to seal it
	 */
	@Transactional
	public AiProvidersResponse createProvider(Actor actor, SaveAiProviderRequest request) {
		Operator operator = identity.requireOperator(actor);
		String baseUrl = address(request.vendor(), request.baseUrl());
		try {
			providers.connect(operator, AiProviders.EMBEDDING, change(request, baseUrl));
		}
		catch (AiException refused) {
			throw worded(refused);
		}
		return providersResponse();
	}

	/**
	 * Changes a provider: its name, its address or its key. A provider in use is rebuilt for search at once.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws SearchException when the provider is gone or changed meanwhile, the address is not valid, the name is
	 * taken, the key is kept for a new address, or the server has no key to seal a new one
	 */
	@Transactional
	public AiProvidersResponse updateProvider(Actor actor, UUID id, SaveAiProviderRequest request) {
		Operator operator = identity.requireOperator(actor);
		String baseUrl = address(request.vendor(), request.baseUrl());
		try {
			providers.change(operator, AiProviders.EMBEDDING, id, change(request, baseUrl));
		}
		catch (AiException refused) {
			throw worded(refused);
		}
		if (id.equals(settings.current().getProviderId())) {
			changedForSearch();
		}
		return providersResponse();
	}

	/**
	 * Deletes a provider and its key.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws SearchException when the provider is gone, or search embeds with it
	 */
	@Transactional
	public AiProvidersResponse deleteProvider(Actor actor, UUID id) {
		Operator operator = identity.requireOperator(actor);
		try {
			providers.get(AiProviders.EMBEDDING, id);
			if (id.equals(settings.current().getProviderId())) {
				throw new SearchException(SearchErrorCode.PROVIDER_IN_USE, "Search embeds with provider " + id);
			}
			providers.remove(operator, AiProviders.EMBEDDING, id);
		}
		catch (AiException refused) {
			throw worded(refused);
		}
		return providersResponse();
	}

	/**
	 * Embeds one test sentence with a connection as the editor holds it, saved or not. Nothing is stored.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws SearchException when the address is not valid, the model is not one the provider offers, or no key is
	 * given and the saved one cannot be used for this address
	 */
	@Transactional(propagation = Propagation.NOT_SUPPORTED)
	public AiProviderTestResponse test(Actor actor, TestAiProviderRequest request) {
		identity.requireOperator(actor);
		String baseUrl = address(request.vendor(), request.baseUrl());
		String model = model(request.vendor(), request.model());
		String key;
		try {
			key = blank(request.apiKey()) ? providers.savedKey(AiProviders.EMBEDDING, request.providerId(), baseUrl)
					: Objects.requireNonNull(request.apiKey()).strip();
		}
		catch (AiException refused) {
			throw worded(refused);
		}
		OpenAiEmbeddings.Probe probe = openAi.probe(baseUrl, key, model);
		return new AiProviderTestResponse(probe.ok(), probe.model(), probe.dimensions(), probe.latencyMs(),
				probe.reason());
	}

	/**
	 * Embeds with this provider's model from now on, after it embedded a test sentence. Every item is embedded again
	 * when the model changes; until then an item is found by keyword search.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws SearchException when the settings changed meanwhile, the provider is gone or has no key, the model is not
	 * one it offers, or the provider did not embed the test sentence
	 */
	@Transactional
	public AiProvidersResponse chooseModel(Actor actor, ChooseEmbeddingModelRequest request) {
		Operator operator = identity.requireOperator(actor);
		SearchSettings row = settings();
		if (row.getVersion() != request.version()) {
			throw changed(request.version(), row.getVersion());
		}
		AiProviderView provider;
		try {
			provider = providers.get(AiProviders.EMBEDDING, request.providerId());
		}
		catch (AiException refused) {
			throw worded(refused);
		}
		String model = model(provider.vendor(), request.model());
		AiConnection connection = providers.connection(AiProviders.EMBEDDING, provider.id())
			.orElseThrow(() -> new SearchException(SearchErrorCode.PROVIDER_KEY_MISSING,
					"Provider " + provider.id() + " has no key that can be read"));
		OpenAiEmbeddings.Probe probe = openAi.probe(connection.baseUrl(), connection.apiKey(), model);
		if (!probe.ok()) {
			throw new SearchException(SearchErrorCode.MODEL_REJECTED,
					"Provider " + provider.id() + " did not embed with " + model + ": " + probe.reason());
		}
		Instant now = Instant.now();
		row.embedWith(provider.id(), model, now);
		row.changedBy(operator.accountId(), operator.label(), now);
		saveSettings(row, request.version());
		audit.record(new AuditRecord(AuditAction.SEARCH_MODEL_CHANGE, actorOf(operator),
				new AuditRecord.Resource("search_settings", "1", "Search settings"), Map.of("model", model)));
		changedForSearch();
		return providersResponse();
	}

	/**
	 * The state of the index and of semantic search, as the Search index screen shows it.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public SearchIndexResponse searchIndex(Actor actor) {
		identity.requireOperator(actor);
		return indexResponse();
	}

	/**
	 * Turns semantic search on or off. Off, search matches keywords only and the job sends nothing to the provider;
	 * on again, it first embeds what changed meanwhile.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws SearchException when the settings changed since they were read
	 */
	@Transactional
	public SearchIndexResponse setSemantic(Actor actor, SetSemanticSearchRequest request) {
		Operator operator = identity.requireOperator(actor);
		SearchSettings row = settings();
		if (row.getVersion() != request.version()) {
			throw changed(request.version(), row.getVersion());
		}
		if (row.isSemanticEnabled() != request.enabled()) {
			row.semantic(request.enabled());
			row.changedBy(operator.accountId(), operator.label(), Instant.now());
			saveSettings(row, request.version());
			audit.record(new AuditRecord(
					request.enabled() ? AuditAction.SEARCH_SEMANTIC_ENABLE : AuditAction.SEARCH_SEMANTIC_DISABLE,
					actorOf(operator), new AuditRecord.Resource("search_settings", "1", "Search settings"), Map.of()));
			changedForSearch();
		}
		return indexResponse();
	}

	/**
	 * Rebuilds the index from what the modules publish now, as the nightly repair does.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional
	public SearchIndexResponse rebuild(Actor actor) {
		Operator operator = identity.requireOperator(actor);
		IndexRepair.Run run = repair.rebuildNow();
		audit.record(new AuditRecord(AuditAction.SEARCH_INDEX_REBUILD, actorOf(operator),
				new AuditRecord.Resource("search_index", "1", "Search index"), Map.of()));
		SearchIndexResponse response = indexResponse();
		return new SearchIndexResponse(response.semantic(), response.kinds(), response.heldBack(),
				new SearchIndexResponse.Rebuild(run.at(), run.saved(), run.removed()), response.settingsVersion());
	}

	/**
	 * Lets held-back items be embedded at the next run: one, or all when no item is named.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional
	public RetriedEmbeddingsResponse retry(Actor actor, RetryEmbeddingsRequest request) {
		Operator operator = identity.requireOperator(actor);
		if (request.itemId() != null && request.kind() == null) {
			throw new SearchException(SearchErrorCode.RETRY_ITEM_INCOMPLETE,
					"Item " + request.itemId() + " was named without its kind");
		}
		int count = index.retryEmbeddings(request.kind(), request.itemId());
		if (count > 0) {
			audit.record(new AuditRecord(AuditAction.SEARCH_EMBEDDING_RETRY, actorOf(operator),
					new AuditRecord.Resource("search_index", "1", "Search index"), Map.of("count", String.valueOf(count))));
		}
		return new RetriedEmbeddingsResponse(count);
	}

	/** Builds the client again and forgets the query vectors and any pause, once the change is committed. */
	private void changedForSearch() {
		TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
			@Override
			public void afterCommit() {
				clients.reload();
				embeddings.forget();
			}
		});
	}

	private AiProvidersResponse providersResponse() {
		SearchSettings row = settings();
		List<AiProviderView> all = providers.list(AiProviders.EMBEDDING);
		AiProvidersResponse.EmbeddingModel inUse = null;
		if (row.getProviderId() != null && row.getModel() != null) {
			String model = row.getModel();
			AiProviderView provider = all.stream().filter(p -> p.id().equals(row.getProviderId())).findFirst().orElse(null);
			List<KindStatus> status = index.status(model);
			inUse = provider == null ? null
					: new AiProvidersResponse.EmbeddingModel(provider.id(), provider.name(), model,
							EmbeddingVendor.DIMENSIONS, row.getModelSince(),
							status.stream().mapToLong(KindStatus::embedded).sum(),
							status.stream().mapToLong(KindStatus::total).sum());
		}
		return new AiProvidersResponse(providers.keysCanBeStored(),
				inUse, all.stream()
					.map(p -> new AiProvidersResponse.Provider(p.id(), p.vendor(), p.name(), p.baseUrl(), p.hasKey(),
							p.id().equals(row.getProviderId()), p.updatedBy(), p.updatedAt(), p.version()))
					.toList(),
				Arrays.stream(EmbeddingVendor.values())
					.map(v -> new AiProvidersResponse.Vendor(v.id(), v.baseUrl(), v.models()))
					.toList(),
				row.getVersion());
	}

	private SearchIndexResponse indexResponse() {
		SearchSettings row = settings();
		EmbeddingClients.Active active = clients.active().orElse(null);
		SearchEmbeddings.State state = embeddings.state();
		String model = active == null ? row.getModel() : active.model();
		String semantic = !row.isSemanticEnabled() ? "off"
				: active == null ? "no_provider" : state.pausedUntil() != null ? "paused" : "on";
		IndexRepair.Run run = repair.lastRun();
		return new SearchIndexResponse(
				new SearchIndexResponse.Semantic(row.isSemanticEnabled(), semantic,
						active == null ? null : active.providerName(), model, state.pausedUntil(), state.failure(),
						state.lastBatchAt()),
				index.status(active == null ? null : active.model())
					.stream()
					.map(k -> new SearchIndexResponse.Kind(k.kind(), k.total(), k.listed(), k.embedded(), k.waiting(),
							k.heldBack()))
					.toList(),
				index.heldBack(HELD_BACK_SHOWN)
					.stream()
					.map(h -> new SearchIndexResponse.HeldBack(h.kind(), h.itemId(), h.title(), heldBackReason(h.error()),
							h.attempts(), h.nextAttemptAt()))
					.toList(),
				run == null ? null : new SearchIndexResponse.Rebuild(run.at(), run.saved(), run.removed()),
				row.getVersion());
	}

	/** A provider as the editor holds it, with the address already checked. */
	private static AiProviderChange change(SaveAiProviderRequest request, String baseUrl) {
		AiProviderChange.Key key = switch (request.key()) {
			case "replace" -> AiProviderChange.Key.REPLACE;
			case "remove" -> AiProviderChange.Key.REMOVE;
			default -> AiProviderChange.Key.KEEP;
		};
		return new AiProviderChange(request.vendor(), request.name(), baseUrl, key, request.apiKey(),
				request.version());
	}

	/** A refusal of the ai module, in the code the Embedding tab has always answered with. */
	private static SearchException worded(AiException refused) {
		SearchErrorCode code = switch (refused.errorCode()) {
			case PROVIDER_NOT_FOUND -> SearchErrorCode.PROVIDER_NOT_FOUND;
			case PROVIDER_NAME_TAKEN -> SearchErrorCode.PROVIDER_NAME_TAKEN;
			case PROVIDER_CHANGED -> SearchErrorCode.PROVIDER_CHANGED;
			case PROVIDER_IN_USE -> SearchErrorCode.PROVIDER_IN_USE;
			case PROVIDER_KEY_MISSING -> SearchErrorCode.PROVIDER_KEY_MISSING;
			case ENCRYPTION_KEY_MISSING -> SearchErrorCode.ENCRYPTION_KEY_MISSING;
		};
		return new SearchException(code, Objects.requireNonNullElse(refused.getMessage(), code.message()));
	}

	private SearchSettings settings() {
		return settings.current();
	}

	/** Saves the settings, refusing them when another change was saved since they were read. */
	private void saveSettings(SearchSettings row, long read) {
		try {
			settings.saveAndFlush(row);
		}
		catch (ObjectOptimisticLockingFailureException raced) {
			throw changed(read, row.getVersion());
		}
	}

	private static AuditRecord.Actor actorOf(Operator operator) {
		return new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email());
	}

	/** The model, when the vendor offers it. */
	private static String model(String vendor, String model) {
		String chosen = model.strip();
		boolean offered = EmbeddingVendor.of(vendor).map(v -> v.models().contains(chosen)).orElse(false);
		if (!offered) {
			throw new SearchException(SearchErrorCode.MODEL_UNKNOWN, vendor + " does not offer " + chosen);
		}
		return chosen;
	}

	/**
	 * The vendor's own API address, which is the only one accepted: the server sends a key to it and calls it from
	 * inside the network, so an operator cannot point either at another host. A trailing slash is ignored.
	 */
	private static String address(String vendor, String baseUrl) {
		String text = baseUrl.strip();
		String own = EmbeddingVendor.of(vendor).map(EmbeddingVendor::baseUrl).orElse("");
		if (own.isEmpty() || !own.equals(text.endsWith("/") ? text.substring(0, text.length() - 1) : text)) {
			throw invalid(text);
		}
		return own;
	}

	/** The kind of failure an item was held back for, as the screen names it. */
	private static String heldBackReason(String error) {
		return switch (error) {
			case "BadRequestException" -> "bad_request";
			case "UnprocessableEntityException" -> "unprocessable";
			default -> "refused";
		};
	}

	private static SearchException invalid(String baseUrl) {
		// The address is not repeated: a query or a user part can carry a secret.
		return new SearchException(SearchErrorCode.PROVIDER_INVALID,
				"Not the vendor's own API address (" + baseUrl.length() + " characters)");
	}

	private static SearchException changed(long read, long now) {
		return new SearchException(SearchErrorCode.SETTINGS_CHANGED, "Search settings read at version " + read + ", now " + now);
	}

	private static boolean blank(@Nullable String value) {
		return value == null || value.isBlank();
	}

}
