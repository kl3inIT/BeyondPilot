package ai.genaifund.beyondpilot.search;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

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
import ai.genaifund.beyondpilot.search.persistence.AiProvider;
import ai.genaifund.beyondpilot.search.persistence.AiProviderRepository;
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
 * What operators do in Admin › AI: connect the providers search embeds with, choose its model, turn semantic search on
 * or off, and look after the index. Keys go in sealed and never come out.
 *
 * <p>
 * A saved key is kept only while the address it was given for is unchanged (Keycloak's rule, as for email): otherwise
 * an operator could point a provider, or a test, at a server of their own and receive the stored key.
 */
@Service
public class SearchAdministration {

	/** How many held-back items the Search index screen lists. */
	private static final int HELD_BACK_SHOWN = 50;

	private final IdentityService identity;

	private final AiProviderRepository providers;

	private final SearchSettingsRepository settings;

	private final SearchDocumentRepository index;

	private final ProviderKeys keys;

	private final OpenAiEmbeddings openAi;

	private final EmbeddingClients clients;

	private final SearchEmbeddings embeddings;

	private final IndexRepair repair;

	private final AuditTrail audit;

	SearchAdministration(IdentityService identity, AiProviderRepository providers, SearchSettingsRepository settings,
			SearchDocumentRepository index, ProviderKeys keys, OpenAiEmbeddings openAi, EmbeddingClients clients,
			SearchEmbeddings embeddings, IndexRepair repair, AuditTrail audit) {
		this.identity = identity;
		this.providers = providers;
		this.settings = settings;
		this.index = index;
		this.keys = keys;
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
		String name = request.name().strip();
		if (providers.existsByPurposeAndNameIgnoreCase(AiProvider.EMBEDDING, name)) {
			throw new SearchException(SearchErrorCode.PROVIDER_NAME_TAKEN, "A provider is already named " + name);
		}
		if (!"replace".equals(request.key()) || blank(request.apiKey())) {
			throw new SearchException(SearchErrorCode.PROVIDER_KEY_MISSING, "A new provider needs its key");
		}
		Instant now = Instant.now();
		AiProvider provider = new AiProvider(AiProvider.EMBEDDING, operator.accountId(), operator.label(), now);
		provider.connectWith(request.vendor(), name, address(request.vendor(), request.baseUrl()),
				keys.seal(Objects.requireNonNull(request.apiKey()).strip()));
		providers.saveAndFlush(provider);
		record(AuditAction.AI_PROVIDER_CREATE, operator, provider, Map.of("vendor", request.vendor()));
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
		AiProvider provider = provider(id);
		if (provider.getVersion() != request.version()) {
			throw new SearchException(SearchErrorCode.PROVIDER_CHANGED,
					"Provider " + id + " read at version " + request.version() + ", now " + provider.getVersion());
		}
		String name = request.name().strip();
		if (!name.equalsIgnoreCase(provider.getName())
				&& providers.existsByPurposeAndNameIgnoreCase(AiProvider.EMBEDDING, name)) {
			throw new SearchException(SearchErrorCode.PROVIDER_NAME_TAKEN, "A provider is already named " + name);
		}
		String baseUrl = address(request.vendor(), request.baseUrl());
		byte[] key = switch (request.key()) {
			case "replace" -> {
				if (blank(request.apiKey())) {
					throw new SearchException(SearchErrorCode.PROVIDER_KEY_MISSING, "Replace was asked without a key");
				}
				yield keys.seal(Objects.requireNonNull(request.apiKey()).strip());
			}
			case "remove" -> null;
			default -> {
				if (!baseUrl.equals(provider.getBaseUrl()) && provider.getApiKey() != null) {
					throw new SearchException(SearchErrorCode.PROVIDER_KEY_MISSING,
							"The address of provider " + id + " changed and its key was kept");
				}
				yield provider.getApiKey();
			}
		};
		provider.connectWith(request.vendor(), name, baseUrl, key);
		provider.changedBy(operator.accountId(), operator.label(), Instant.now());
		try {
			providers.saveAndFlush(provider);
		}
		catch (ObjectOptimisticLockingFailureException raced) {
			throw new SearchException(SearchErrorCode.PROVIDER_CHANGED, "Provider " + id + " changed while it was saved");
		}
		String change = switch (request.key()) {
			case "replace" -> "replaced";
			case "remove" -> "removed";
			default -> "kept";
		};
		record(AuditAction.AI_PROVIDER_UPDATE, operator, provider, Map.of("vendor", request.vendor(), "key", change));
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
		AiProvider provider = provider(id);
		if (id.equals(settings.current().getProviderId())) {
			throw new SearchException(SearchErrorCode.PROVIDER_IN_USE, "Search embeds with provider " + id);
		}
		providers.delete(provider);
		providers.flush();
		record(AuditAction.AI_PROVIDER_DELETE, operator, provider, Map.of());
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
		String key = blank(request.apiKey()) ? savedKey(request.providerId(), baseUrl)
				: Objects.requireNonNull(request.apiKey()).strip();
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
		AiProvider provider = provider(request.providerId());
		String model = model(provider.getVendor(), request.model());
		String key = keys.open(provider.getApiKey())
			.orElseThrow(() -> new SearchException(SearchErrorCode.PROVIDER_KEY_MISSING,
					"Provider " + provider.getId() + " has no key that can be read"));
		OpenAiEmbeddings.Probe probe = openAi.probe(provider.getBaseUrl(), key, model);
		if (!probe.ok()) {
			throw new SearchException(SearchErrorCode.MODEL_REJECTED,
					"Provider " + provider.getId() + " did not embed with " + model + ": " + probe.reason());
		}
		Instant now = Instant.now();
		row.embedWith(provider.getId(), model, now);
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
		List<AiProvider> all = providers.findByPurposeOrderByName(AiProvider.EMBEDDING);
		AiProvidersResponse.EmbeddingModel inUse = null;
		if (row.getProviderId() != null && row.getModel() != null) {
			String model = row.getModel();
			AiProvider provider = all.stream().filter(p -> p.getId().equals(row.getProviderId())).findFirst().orElse(null);
			List<KindStatus> status = index.status(model);
			inUse = provider == null ? null
					: new AiProvidersResponse.EmbeddingModel(provider.getId(), provider.getName(), model,
							EmbeddingVendor.DIMENSIONS, row.getModelSince(),
							status.stream().mapToLong(KindStatus::embedded).sum(),
							status.stream().mapToLong(KindStatus::total).sum());
		}
		return new AiProvidersResponse(keys.open(),
				inUse, all.stream()
					.map(p -> new AiProvidersResponse.Provider(p.getId(), p.getVendor(), p.getName(), p.getBaseUrl(),
							p.getApiKey() != null, p.getId().equals(row.getProviderId()), p.getUpdatedByLabel(),
							p.getUpdatedAt(), p.getVersion()))
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

	/** The saved key of a provider, for the address it was given for only. */
	private String savedKey(@Nullable UUID providerId, String baseUrl) {
		if (providerId == null) {
			throw new SearchException(SearchErrorCode.PROVIDER_KEY_MISSING, "A test without a key names no provider");
		}
		AiProvider provider = provider(providerId);
		if (!provider.getBaseUrl().equals(baseUrl)) {
			throw new SearchException(SearchErrorCode.PROVIDER_KEY_MISSING,
					"The saved key of provider " + providerId + " is not sent to another address");
		}
		return keys.open(provider.getApiKey())
			.orElseThrow(() -> new SearchException(SearchErrorCode.PROVIDER_KEY_MISSING,
					"Provider " + providerId + " has no key that can be read"));
	}

	private AiProvider provider(UUID id) {
		return providers.findById(id)
			.filter(p -> AiProvider.EMBEDDING.equals(p.getPurpose()))
			.orElseThrow(() -> new SearchException(SearchErrorCode.PROVIDER_NOT_FOUND, "No provider " + id));
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

	private void record(AuditAction action, Operator operator, AiProvider provider, Map<String, String> details) {
		audit.record(new AuditRecord(action, actorOf(operator),
				new AuditRecord.Resource("ai_provider", provider.getId().toString(), provider.getName()), details));
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
