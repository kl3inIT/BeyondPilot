package ai.genaifund.beyondpilot.ai;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.ai.adapter.ChatEndpoints;
import ai.genaifund.beyondpilot.ai.adapter.OcrAdapter;
import ai.genaifund.beyondpilot.ai.adapter.OcrAdapterRegistry;
import ai.genaifund.beyondpilot.ai.adapter.OcrConnection;
import ai.genaifund.beyondpilot.ai.adapter.OcrProviderException;
import ai.genaifund.beyondpilot.ai.dto.OcrProviderTestResponse;
import ai.genaifund.beyondpilot.ai.dto.OcrSettingsResponse;
import ai.genaifund.beyondpilot.ai.dto.ProbeOcrProviderRequest;
import ai.genaifund.beyondpilot.ai.dto.SaveOcrProviderRequest;
import ai.genaifund.beyondpilot.ai.dto.SetDocumentReaderRequest;
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
import org.springframework.core.io.ClassPathResource;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * What operators do in the OCR tab of Admin › AI › Providers: connect OCR services, and choose what reads a page that
 * is only a picture, a chat model that reads images or one of those services.
 *
 * <p>
 * A call to a service is never made inside a database transaction.
 */
@Service
public class OcrAdministration {

	private static final Logger LOG = LoggerFactory.getLogger(OcrAdministration.class);

	/** The picture a connection test sends: one line of text, drawn once and shipped with the application. */
	private static final String TEST_PICTURE = "ai/ocr-test.jpg";

	/** What a service that reads the test picture answers with, whatever else it adds. */
	private static final String TEST_TEXT = "2468";

	private static final AiTask READING = AiTask.DOCUMENT_READING;

	private final IdentityService identity;

	private final AiProviders providers;

	private final AiModelRepository models;

	private final AiTaskModelRepository tasks;

	private final OcrAdapterRegistry adapters;

	private final AiSettings settings;

	private final Prices prices;

	private final AuditTrail audit;

	OcrAdministration(IdentityService identity, AiProviders providers, AiModelRepository models,
			AiTaskModelRepository tasks, OcrAdapterRegistry adapters, AiSettings settings, Prices prices,
			AuditTrail audit) {
		this.prices = prices;
		this.identity = identity;
		this.providers = providers;
		this.models = models;
		this.tasks = tasks;
		this.adapters = adapters;
		this.settings = settings;
		this.audit = audit;
	}

	/**
	 * The OCR providers, and what reads pages.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public OcrSettingsResponse ocr(Actor actor) {
		identity.requireOperator(actor);
		return response();
	}

	/**
	 * Connects an OCR provider.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws AiException when the adapter is unknown, the address is not valid, the name is taken, the key is missing,
	 * or the server has no key to seal it
	 */
	@Transactional
	public OcrSettingsResponse connectProvider(Actor actor, SaveOcrProviderRequest request) {
		Operator operator = identity.requireOperator(actor);
		providers.connect(operator, AiProviders.OCR, change(request));
		return response();
	}

	/**
	 * Changes an OCR provider: its name, its address, its key, or whether it is switched on.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws AiException when the provider is gone or changed meanwhile, the adapter is unknown, the address is not
	 * valid, the name is taken, or the key is kept for a new address
	 */
	@Transactional
	public OcrSettingsResponse changeProvider(Actor actor, UUID id, SaveOcrProviderRequest request) {
		Operator operator = identity.requireOperator(actor);
		providers.change(operator, AiProviders.OCR, id, change(request));
		return response();
	}

	/**
	 * Removes an OCR provider with its key. If it read pages, nothing does until an operator chooses again.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws AiException when the provider is gone
	 */
	@Transactional
	public OcrSettingsResponse removeProvider(Actor actor, UUID id) {
		Operator operator = identity.requireOperator(actor);
		providers.remove(operator, AiProviders.OCR, id);
		return response();
	}

	/**
	 * Tries a connection, saved or not, by sending the picture kept for this and looking for its line of text in the
	 * answer. It spends one call at the service; nothing is stored.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws AiException when the adapter is unknown, the address is not valid, or no key is given and the saved one
	 * cannot be used for this address
	 */
	@Transactional(propagation = Propagation.NOT_SUPPORTED)
	public OcrProviderTestResponse testProvider(Actor actor, ProbeOcrProviderRequest request) {
		identity.requireOperator(actor);
		OcrAdapter adapter = adapter(request.adapterType());
		String baseUrl = endpoint(request.baseUrl());
		String key = request.apiKey() == null || request.apiKey().isBlank()
				? providers.savedKey(AiProviders.OCR, request.providerId(), baseUrl) : request.apiKey().strip();
		byte[] picture = testPicture();
		long started = System.nanoTime();
		try {
			String text = adapter.read(new OcrConnection(baseUrl, key), picture, settings.listTimeout());
			boolean read = text.contains(TEST_TEXT);
			return new OcrProviderTestResponse(read, millisSince(started), read ? null : "misread");
		}
		catch (OcrProviderException failed) {
			LOG.atInfo()
				.addKeyValue("event", "ai.ocr.test_failed")
				.addKeyValue("error_type", failed.getClass().getName())
				.addKeyValue("error_code", failed.failure().name())
				.log("An OCR service did not read the test picture");
			return new OcrProviderTestResponse(false, millisSince(started), switch (failed.failure()) {
				case CREDENTIAL_REJECTED -> "rejected";
				case UNREACHABLE -> "unreachable";
				case INCOMPATIBLE -> "incompatible";
				case PICTURE_REFUSED -> "refused";
			});
		}
	}

	/**
	 * Chooses what reads a page that is only a picture: a model that reads images, an OCR provider, or nothing. The
	 * choice is saved at once.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws AiException when both a model and a provider are named, the reader changed meanwhile, the model or the
	 * provider is gone, switched off or without a key, or the model does not read images
	 */
	@Transactional
	public OcrSettingsResponse setReader(Actor actor, SetDocumentReaderRequest request) {
		Operator operator = identity.requireOperator(actor);
		if (request.modelId() != null && request.ocrProviderId() != null) {
			throw new AiException(AiErrorCode.READER_AMBIGUOUS, "A model and an OCR provider were both named");
		}
		AiTaskModel row = row();
		if (row.getVersion() != request.version()) {
			throw new AiException(AiErrorCode.TASK_CHANGED,
					"The reader was read at version " + request.version() + ", now " + row.getVersion());
		}
		Instant now = Instant.now();
		Map<String, String> chosen;
		if (request.ocrProviderId() != null) {
			AiProviderView provider = providers.get(AiProviders.OCR, request.ocrProviderId());
			if (!provider.enabled() || !provider.hasKey()) {
				throw new AiException(AiErrorCode.OCR_PROVIDER_UNAVAILABLE,
						"OCR provider " + provider.id() + " is off or has no key");
			}
			row.readWith(provider.id(), operator.accountId(), operator.label(), now);
			chosen = Map.of("ocr", provider.name());
		}
		else {
			String modelName = "none";
			if (request.modelId() != null) {
				AiModel model = models.findById(request.modelId())
					.orElseThrow(() -> new AiException(AiErrorCode.MODEL_NOT_FOUND, "No model " + request.modelId()));
				AiProviderView provider = providers.get(AiProviders.CHAT, model.getProviderId());
				if (!provider.enabled() || !provider.hasKey()) {
					throw new AiException(AiErrorCode.MODEL_UNAVAILABLE,
							"Provider " + provider.id() + " of model " + model.getId() + " is off or has no key");
				}
				if (!model.isVision()) {
					throw new AiException(AiErrorCode.MODEL_WITHOUT_VISION,
							"Pages are sent as pictures and model " + model.getId() + " does not read them");
				}
				modelName = model.getModelName();
			}
			row.use(request.modelId(), request.reasoningEffort(), operator.accountId(), operator.label(), now);
			chosen = Map.of("model", modelName, "reasoning", AiAdministration.effort(READING, row).value());
		}
		try {
			tasks.saveAndFlush(row);
		}
		catch (ObjectOptimisticLockingFailureException raced) {
			throw new AiException(AiErrorCode.TASK_CHANGED, "The reader changed while it was saved");
		}
		audit.record(new AuditRecord(AuditAction.AI_TASK_MODEL_CHANGE,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource("ai_task", READING.value(), READING.value()), chosen));
		return response();
	}

	private OcrSettingsResponse response() {
		AiTaskModel row = row();
		UUID service = row.getOcrProviderId();
		List<AiProviderView> all = providers.list(AiProviders.OCR);
		boolean available;
		if (service != null) {
			available = all.stream()
				.anyMatch(provider -> provider.id().equals(service) && provider.enabled() && provider.hasKey()
						&& adapters.adapter(provider.adapterType()).isPresent());
		}
		else {
			UUID modelId = row.getModelId();
			AiModel model = modelId == null ? null : models.findById(modelId).orElse(null);
			AiProviderView provider = model == null ? null : providers.get(AiProviders.CHAT, model.getProviderId());
			available = provider != null && provider.enabled() && provider.hasKey();
		}
		return new OcrSettingsResponse(providers.keysCanBeStored(), adapters.types(),
				all.stream()
					.map(provider -> shown(provider, provider.id().equals(service),
							prices.ofOcr(provider.adapterType(), provider.pricePerThousandCalls())))
					.toList(),
				new OcrSettingsResponse.Reader(row.getModelId(), AiAdministration.effort(READING, row).value(), service,
						available, row.getVersion()));
	}

	private AiTaskModel row() {
		return tasks.findById(READING.value())
			.orElseThrow(() -> new AiException(AiErrorCode.TASK_UNKNOWN, "No row for task " + READING.value()));
	}

	/** A provider as the editor holds it, once its adapter is known and its address is one a provider may have. */
	private AiProviderChange change(SaveOcrProviderRequest request) {
		adapter(request.adapterType());
		AiProviderChange.Key key = switch (request.key()) {
			case "replace" -> AiProviderChange.Key.REPLACE;
			case "remove" -> AiProviderChange.Key.REMOVE;
			default -> AiProviderChange.Key.KEEP;
		};
		return new AiProviderChange(null, request.adapterType(), request.name(), endpoint(request.baseUrl()),
				request.enabled(), key, request.apiKey(), request.version(),
				// A price that is the catalog's is not kept: the provider then follows the catalog.
				prices.ocrToKeep(request.adapterType(), request.pricePerThousandCalls()));
	}

	private static OcrSettingsResponse.Provider shown(AiProviderView provider, boolean reads, Prices.OfCalls price) {
		return new OcrSettingsResponse.Provider(provider.id(), provider.name(), provider.adapterType(),
				provider.baseUrl(), provider.enabled(), provider.hasKey(), reads, price.perThousand(),
				price.fromCatalog(), provider.updatedBy(), provider.updatedAt(), provider.version());
	}

	private OcrAdapter adapter(String type) {
		return adapters.adapter(type)
			.orElseThrow(() -> new AiException(AiErrorCode.PROVIDER_ADAPTER_UNKNOWN, "No OCR adapter of type " + type));
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

	private static byte[] testPicture() {
		try (InputStream picture = new ClassPathResource(TEST_PICTURE).getInputStream()) {
			return picture.readAllBytes();
		}
		catch (IOException missing) {
			throw new UncheckedIOException(missing);
		}
	}

	private static long millisSince(long started) {
		return (System.nanoTime() - started) / 1_000_000;
	}

}
