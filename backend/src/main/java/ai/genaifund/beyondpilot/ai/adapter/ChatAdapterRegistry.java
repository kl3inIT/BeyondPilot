package ai.genaifund.beyondpilot.ai.adapter;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;

/** Resolves a chat adapter by its type. Startup fails when two adapters declare one type. */
@Component
public class ChatAdapterRegistry {

	private final Map<String, ChatAdapter> adapters;

	ChatAdapterRegistry(List<ChatAdapter> adapters) {
		// toUnmodifiableMap refuses a second adapter of one type, which stops the application from starting.
		this.adapters = adapters.stream().collect(Collectors.toUnmodifiableMap(ChatAdapter::type, Function.identity()));
	}

	public Optional<ChatAdapter> adapter(String type) {
		return Optional.ofNullable(adapters.get(type));
	}

	/** The types a provider can be stored with, in order. */
	public List<String> types() {
		return adapters.keySet().stream().sorted().toList();
	}

}
