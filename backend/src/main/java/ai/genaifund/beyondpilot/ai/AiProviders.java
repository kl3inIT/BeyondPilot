package ai.genaifund.beyondpilot.ai;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import ai.genaifund.beyondpilot.ai.persistence.AiProvider;
import ai.genaifund.beyondpilot.ai.persistence.AiProviderRepository;
import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Operator;
import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The providers operators connected, each for one purpose, and their keys. The module that uses a purpose decides what
 * an address and a model may be; this service keeps the provider, seals its key and records each change.
 *
 * <p>
 * A saved key is kept only while the address it was given for is unchanged (Keycloak's rule, as for email): otherwise
 * an operator could point a provider, or a test, at a server of their own and receive the stored key.
 */
@Service
@EnableConfigurationProperties(AiSettings.class)
public class AiProviders {

	/** What embeds text for search. */
	public static final String EMBEDDING = AiProvider.EMBEDDING;

	private final AiProviderRepository providers;

	private final AiKeys keys;

	private final AuditTrail audit;

	AiProviders(AiProviderRepository providers, AiKeys keys, AuditTrail audit) {
		this.providers = providers;
		this.keys = keys;
		this.audit = audit;
	}

	/** Whether the server holds the key that seals provider keys; without it none can be saved or read. */
	public boolean keysCanBeStored() {
		return keys.open();
	}

	/** The providers connected for a purpose, by name. */
	@Transactional(readOnly = true)
	public List<AiProviderView> list(String purpose) {
		return providers.findByPurposeOrderByName(purpose).stream().map(AiProviders::view).toList();
	}

	/**
	 * Connects a provider. The caller has already settled what the address may be.
	 * @throws AiException when the name is taken, the key is missing, or the server has no key to seal it
	 */
	@Transactional
	public AiProviderView connect(Operator operator, String purpose, AiProviderChange change) {
		String name = change.name().strip();
		if (providers.existsByPurposeAndNameIgnoreCase(purpose, name)) {
			throw new AiException(AiErrorCode.PROVIDER_NAME_TAKEN, "A provider is already named " + name);
		}
		if (change.key() != AiProviderChange.Key.REPLACE || blank(change.apiKey())) {
			throw new AiException(AiErrorCode.PROVIDER_KEY_MISSING, "A new provider needs its key");
		}
		AiProvider provider = new AiProvider(purpose, operator.accountId(), operator.label(), Instant.now());
		provider.connectWith(change.vendor(), name, change.baseUrl(),
				keys.seal(Objects.requireNonNull(change.apiKey()).strip()));
		providers.saveAndFlush(provider);
		record(AuditAction.AI_PROVIDER_CREATE, operator, provider, Map.of("vendor", change.vendor()));
		return view(provider);
	}

	/**
	 * Changes a provider: its name, its address or its key.
	 * @throws AiException when the provider is gone or changed meanwhile, the name is taken, the key is kept for a new
	 * address, or the server has no key to seal a new one
	 */
	@Transactional
	public AiProviderView change(Operator operator, String purpose, UUID id, AiProviderChange change) {
		AiProvider provider = provider(purpose, id);
		if (provider.getVersion() != change.version()) {
			throw new AiException(AiErrorCode.PROVIDER_CHANGED,
					"Provider " + id + " read at version " + change.version() + ", now " + provider.getVersion());
		}
		String name = change.name().strip();
		if (!name.equalsIgnoreCase(provider.getName()) && providers.existsByPurposeAndNameIgnoreCase(purpose, name)) {
			throw new AiException(AiErrorCode.PROVIDER_NAME_TAKEN, "A provider is already named " + name);
		}
		byte[] key = switch (change.key()) {
			case REPLACE -> {
				if (blank(change.apiKey())) {
					throw new AiException(AiErrorCode.PROVIDER_KEY_MISSING, "Replace was asked without a key");
				}
				yield keys.seal(Objects.requireNonNull(change.apiKey()).strip());
			}
			case REMOVE -> null;
			case KEEP -> {
				if (!change.baseUrl().equals(provider.getBaseUrl()) && provider.getApiKey() != null) {
					throw new AiException(AiErrorCode.PROVIDER_KEY_MISSING,
							"The address of provider " + id + " changed and its key was kept");
				}
				yield provider.getApiKey();
			}
		};
		provider.connectWith(change.vendor(), name, change.baseUrl(), key);
		provider.changedBy(operator.accountId(), operator.label(), Instant.now());
		try {
			providers.saveAndFlush(provider);
		}
		catch (ObjectOptimisticLockingFailureException raced) {
			throw new AiException(AiErrorCode.PROVIDER_CHANGED, "Provider " + id + " changed while it was saved");
		}
		String kept = switch (change.key()) {
			case REPLACE -> "replaced";
			case REMOVE -> "removed";
			case KEEP -> "kept";
		};
		record(AuditAction.AI_PROVIDER_UPDATE, operator, provider, Map.of("vendor", change.vendor(), "key", kept));
		return view(provider);
	}

	/**
	 * Removes a provider and its key.
	 * @throws AiException when the provider is gone, or something still uses it
	 */
	@Transactional
	public void remove(Operator operator, String purpose, UUID id) {
		AiProvider provider = provider(purpose, id);
		try {
			providers.delete(provider);
			providers.flush();
		}
		catch (DataIntegrityViolationException used) {
			// What uses a provider points at it in the database, so the database is what refuses.
			throw new AiException(AiErrorCode.PROVIDER_IN_USE, "Provider " + id + " is still referred to");
		}
		record(AuditAction.AI_PROVIDER_DELETE, operator, provider, Map.of());
	}

	/** A provider of a purpose with its key in clear, to call it with; empty when it is gone or its key cannot be read. */
	@Transactional(readOnly = true)
	public Optional<AiConnection> connection(String purpose, UUID id) {
		return providers.findById(id)
			.filter(provider -> purpose.equals(provider.getPurpose()))
			.flatMap(provider -> keys.open(provider.getApiKey())
				.map(key -> new AiConnection(provider.getId(), provider.getVendor(), provider.getName(),
						provider.getBaseUrl(), key)));
	}

	/**
	 * The saved key of a provider, for the address it was given for only.
	 * @throws AiException when no provider is named, it is gone, the address is another one, or the key cannot be read
	 */
	@Transactional(readOnly = true)
	public String savedKey(String purpose, @Nullable UUID id, String baseUrl) {
		if (id == null) {
			throw new AiException(AiErrorCode.PROVIDER_KEY_MISSING, "A test without a key names no provider");
		}
		AiProvider provider = provider(purpose, id);
		if (!provider.getBaseUrl().equals(baseUrl)) {
			throw new AiException(AiErrorCode.PROVIDER_KEY_MISSING,
					"The saved key of provider " + id + " is not sent to another address");
		}
		return keys.open(provider.getApiKey())
			.orElseThrow(() -> new AiException(AiErrorCode.PROVIDER_KEY_MISSING,
					"Provider " + id + " has no key that can be read"));
	}

	/**
	 * One provider of a purpose.
	 * @throws AiException when there is none
	 */
	@Transactional(readOnly = true)
	public AiProviderView get(String purpose, UUID id) {
		return view(provider(purpose, id));
	}

	private AiProvider provider(String purpose, UUID id) {
		return providers.findById(id)
			.filter(provider -> purpose.equals(provider.getPurpose()))
			.orElseThrow(() -> new AiException(AiErrorCode.PROVIDER_NOT_FOUND, "No provider " + id));
	}

	private void record(AuditAction action, Operator operator, AiProvider provider, Map<String, String> details) {
		audit.record(new AuditRecord(action,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource("ai_provider", provider.getId().toString(), provider.getName()), details));
	}

	private static AiProviderView view(AiProvider provider) {
		return new AiProviderView(provider.getId(), provider.getVendor(), provider.getName(), provider.getBaseUrl(),
				provider.getApiKey() != null, provider.getUpdatedByLabel(), provider.getUpdatedAt(),
				provider.getVersion());
	}

	private static boolean blank(@Nullable String value) {
		return value == null || value.isBlank();
	}

}
