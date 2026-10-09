package ai.genaifund.beyondpilot.ai;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * What services that bill by the call charge, from the list bundled at {@code ai/known-services.json}. It is kept by
 * hand, apart from {@link KnownModels}, whose file is regenerated from LiteLLM's list and holds models billed by the
 * token.
 */
@Component
class KnownServices {

	private final Map<String, BigDecimal> ocr;

	KnownServices() {
		try (InputStream json = new ClassPathResource("ai/known-services.json").getInputStream()) {
			Map<String, BigDecimal> read = new HashMap<>();
			for (JsonNode service : JsonMapper.builder().build().readTree(json).path("ocr")) {
				JsonNode price = service.path("pricePerThousandCalls");
				if (price.isNumber()) {
					read.put(service.path("adapterType").asString(), price.decimalValue());
				}
			}
			this.ocr = Map.copyOf(read);
		}
		catch (IOException unreadable) {
			throw new UncheckedIOException(unreadable);
		}
	}

	/** What 1,000 calls to the OCR service an adapter speaks to cost, in US dollars; empty when nobody listed it. */
	Optional<BigDecimal> ocrPricePerThousandCalls(String adapterType) {
		return Optional.ofNullable(ocr.get(adapterType));
	}

}
