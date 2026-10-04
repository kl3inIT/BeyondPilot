package ai.genaifund.beyondpilot.storage.adapter;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

/** Resolves the adapter of an object store. Startup fails when a store has no adapter, or two. */
@Component
public class ObjectStorageAdapterRegistry {

	private final Map<ObjectStorageProvider, ObjectStorageAdapter> adapters = new EnumMap<>(ObjectStorageProvider.class);

	ObjectStorageAdapterRegistry(List<ObjectStorageAdapter> adapters) {
		for (ObjectStorageAdapter adapter : adapters) {
			if (this.adapters.putIfAbsent(adapter.provider(), adapter) != null) {
				throw new IllegalStateException("Two adapters are registered for object store " + adapter.provider());
			}
		}
		EnumSet<ObjectStorageProvider> missing = EnumSet.allOf(ObjectStorageProvider.class);
		missing.removeAll(this.adapters.keySet());
		if (!missing.isEmpty()) {
			throw new IllegalStateException("No adapter is registered for object stores " + missing);
		}
	}

	public ObjectStorageAdapter adapter(ObjectStorageProvider provider) {
		return adapters.get(provider);
	}
}
