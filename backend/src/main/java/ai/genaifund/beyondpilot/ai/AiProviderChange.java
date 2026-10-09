package ai.genaifund.beyondpilot.ai;

import java.math.BigDecimal;

import org.jspecify.annotations.Nullable;

/**
 * A provider as an editor holds it, after the module that uses it settled its address.
 * @param vendor the vendor of an embedding provider; null for a chat provider
 * @param adapterType the adapter that speaks its API
 * @param apiKey the new key, with {@link Key#REPLACE}
 * @param version the version the provider was read at; ignored for a new one
 * @param pricePerThousandCalls what 1,000 calls cost in US dollars, for a service that bills by the call; null for a
 * provider that bills by the token, and when it is not known
 */
public record AiProviderChange(@Nullable String vendor, String adapterType, String name, String baseUrl,
		boolean enabled, Key key, @Nullable String apiKey, long version, @Nullable BigDecimal pricePerThousandCalls) {

	/** A provider that bills by the token: a chat or an embedding provider. */
	public AiProviderChange(@Nullable String vendor, String adapterType, String name, String baseUrl, boolean enabled,
			Key key, @Nullable String apiKey, long version) {
		this(vendor, adapterType, name, baseUrl, enabled, key, apiKey, version, null);
	}

	/** What becomes of the saved key. */
	public enum Key {

		KEEP, REPLACE, REMOVE

	}

	@Override
	public String toString() {
		// A key must not reach a log through a record's generated text.
		return "AiProviderChange[" + adapterType + ", " + name + ", key " + key + "]";
	}

}
