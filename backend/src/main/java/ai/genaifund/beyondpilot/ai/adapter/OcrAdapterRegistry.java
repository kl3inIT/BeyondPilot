package ai.genaifund.beyondpilot.ai.adapter;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;

/** Resolves an OCR adapter by its type. Startup fails when two adapters declare one type. */
@Component
public class OcrAdapterRegistry {

	private final Map<String, OcrAdapter> adapters;

	OcrAdapterRegistry(List<OcrAdapter> adapters) {
		// toUnmodifiableMap refuses a second adapter of one type, which stops the application from starting.
		this.adapters = adapters.stream().collect(Collectors.toUnmodifiableMap(OcrAdapter::type, Function.identity()));
	}

	public Optional<OcrAdapter> adapter(String type) {
		return Optional.ofNullable(adapters.get(type));
	}

	/** The types a provider can be stored with, in order. */
	public List<String> types() {
		return adapters.keySet().stream().sorted().toList();
	}

}
