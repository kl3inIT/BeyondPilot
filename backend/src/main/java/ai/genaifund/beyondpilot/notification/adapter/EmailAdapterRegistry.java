package ai.genaifund.beyondpilot.notification.adapter;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

/** Resolves the adapter of an email provider. Startup fails when a provider has no adapter, or two. */
@Component
public class EmailAdapterRegistry {

	private final Map<EmailProvider, EmailAdapter> adapters = new EnumMap<>(EmailProvider.class);

	EmailAdapterRegistry(List<EmailAdapter> adapters) {
		for (EmailAdapter adapter : adapters) {
			if (this.adapters.putIfAbsent(adapter.provider(), adapter) != null) {
				throw new IllegalStateException("Two adapters are registered for email provider " + adapter.provider());
			}
		}
		EnumSet<EmailProvider> missing = EnumSet.allOf(EmailProvider.class);
		missing.removeAll(this.adapters.keySet());
		if (!missing.isEmpty()) {
			throw new IllegalStateException("No adapter is registered for email providers " + missing);
		}
	}

	public EmailAdapter adapter(EmailProvider provider) {
		return adapters.get(provider);
	}

}
