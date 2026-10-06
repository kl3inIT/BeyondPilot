package ai.genaifund.beyondpilot.search;

import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import ai.genaifund.beyondpilot.search.persistence.AiProvider;
import ai.genaifund.beyondpilot.search.persistence.AiProviderRepository;
import ai.genaifund.beyondpilot.search.persistence.SearchSettings;
import ai.genaifund.beyondpilot.search.persistence.SearchSettingsRepository;
import org.jspecify.annotations.Nullable;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.stereotype.Component;

/**
 * The embedding client search uses, built from what operators set in Admin › AI › Providers and built again when they
 * change it, so a new key or model takes effect without a restart. One instance runs, so a change made here is the
 * only one there is.
 */
@Component
class EmbeddingClients {

	private final SearchSettingsRepository settings;

	private final AiProviderRepository providers;

	private final ProviderKeys keys;

	private final OpenAiEmbeddings openAi;

	private volatile @Nullable Snapshot snapshot;

	EmbeddingClients(SearchSettingsRepository settings, AiProviderRepository providers, ProviderKeys keys,
			OpenAiEmbeddings openAi) {
		this.settings = settings;
		this.providers = providers;
		this.keys = keys;
		this.openAi = openAi;
	}

	/** The client to embed with, or empty when semantic search is off or nothing usable is set. */
	Optional<Active> active() {
		Snapshot current = current();
		return current.enabled() ? Optional.ofNullable(current.active()) : Optional.empty();
	}

	/** Whether semantic search is on, whether or not a provider is usable. */
	boolean enabled() {
		return current().enabled();
	}

	/** Reads the settings again; called after every change of them. */
	synchronized void reload() {
		SearchSettings row = settings.current();
		UUID providerId = row.getProviderId();
		String model = row.getModel();
		Active active = null;
		if (providerId != null && model != null) {
			AiProvider provider = providers.findById(providerId).orElse(null);
			String key = provider == null ? null : keys.open(provider.getApiKey()).orElse(null);
			if (provider != null && key != null) {
				active = new Active(provider.getId(), provider.getName(), model,
						openAi.connect(provider.getBaseUrl(), key, model));
			}
		}
		snapshot = new Snapshot(row.isSemanticEnabled(), active);
	}

	private Snapshot current() {
		Snapshot current = snapshot;
		if (current == null) {
			reload();
			current = snapshot;
		}
		return Objects.requireNonNull(current);
	}

	/** The provider and model in use, and a client for them. */
	record Active(UUID providerId, String providerName, String model, EmbeddingModel client) {
	}

	private record Snapshot(boolean enabled, @Nullable Active active) {
	}

}
