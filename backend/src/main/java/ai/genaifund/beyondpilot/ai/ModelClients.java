package ai.genaifund.beyondpilot.ai;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Supplier;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.model.ChatModel;

/**
 * Keeps the clients that reach chat models, a bounded number of them, after MemoryOS's {@code ModelClients}. A call
 * borrows a client and gives it back. When the settings a client was built from change, it takes no new call and is
 * closed once the last call it serves has returned, so an answer still arriving is never cut by an operator's change.
 */
final class ModelClients implements AutoCloseable {

	private static final Logger LOG = LoggerFactory.getLogger(ModelClients.class);

	private final int capacity;

	/** The client to hand out for each key, least recently used first. */
	private final LinkedHashMap<String, Entry> current = new LinkedHashMap<>(16, .75f, true);

	/** Every client not yet closed: those in {@link #current} and those retired with a call still running. */
	private final List<Entry> live = new ArrayList<>();

	private boolean closed;

	ModelClients(int capacity) {
		if (capacity < 1 || capacity > 1024) {
			throw new IllegalArgumentException("Invalid chat client capacity");
		}
		this.capacity = capacity;
	}

	/**
	 * Borrows the client of a key, building it when there is none or when the revision it was built for has changed.
	 * @param revision what the client depends on; a different value retires the client built for the last one
	 * @throws AiException when every client is in use, or the cache is shutting down
	 */
	Lease acquire(String key, String revision, Supplier<ChatModel> factory) {
		List<Entry> cleanup = new ArrayList<>();
		Entry entry;
		boolean build = false;
		try {
			synchronized (this) {
				if (closed) {
					throw new AiException(AiErrorCode.BUSY, "The chat clients are shutting down");
				}
				entry = current.get(key);
				if (entry != null && !entry.revision.equals(revision)) {
					current.remove(key);
					retire(entry, cleanup);
					entry = null;
				}
				if (entry == null) {
					if (live.size() >= capacity) {
						var idle = current.entrySet().iterator();
						while (idle.hasNext()) {
							Entry candidate = idle.next().getValue();
							if (candidate.references == 0) {
								idle.remove();
								retire(candidate, cleanup);
								break;
							}
						}
					}
					if (live.size() >= capacity) {
						throw new AiException(AiErrorCode.BUSY, "All " + capacity + " chat clients are in use");
					}
					entry = new Entry(revision);
					current.put(key, entry);
					live.add(entry);
					build = true;
				}
				// Counted before the client exists, so callers waiting on the same key hold it too.
				entry.references++;
			}
		}
		finally {
			cleanup.forEach(ModelClients::dispose);
		}
		if (build) {
			// Built outside the lock: other keys do not wait, and callers of this key wait on the future.
			try {
				entry.client.complete(Objects.requireNonNull(factory.get()));
			}
			catch (RuntimeException | Error failure) {
				synchronized (this) {
					current.remove(key, entry);
					entry.retired = true;
				}
				entry.client.completeExceptionally(failure);
			}
		}
		try {
			return new Lease(entry, entry.client.join());
		}
		catch (CompletionException failure) {
			release(entry);
			if (failure.getCause() instanceof RuntimeException cause) {
				throw cause;
			}
			if (failure.getCause() instanceof Error cause) {
				throw cause;
			}
			throw new AiException(AiErrorCode.BUSY, "A chat client could not be built");
		}
	}

	private void retire(Entry entry, List<Entry> cleanup) {
		entry.retired = true;
		if (entry.references == 0) {
			live.remove(entry);
			cleanup.add(entry);
		}
	}

	private static void dispose(Entry entry) {
		if (entry.client.isCompletedExceptionally()) {
			return;
		}
		// Spring AI's models own their HTTP client; one that can be closed is closed here.
		if (entry.client.join() instanceof AutoCloseable closeable) {
			try {
				closeable.close();
			}
			catch (Exception failure) {
				LOG.atWarn()
					.addKeyValue("event", "ai.client.cleanup_failed")
					.addKeyValue("error_type", failure.getClass().getName())
					.log("A chat client could not be closed");
			}
		}
	}

	private void release(Entry entry) {
		boolean dispose;
		synchronized (this) {
			entry.references--;
			dispose = entry.references == 0 && entry.retired;
			if (dispose) {
				live.remove(entry);
			}
		}
		if (dispose) {
			dispose(entry);
		}
	}

	/** How many clients are not yet closed. */
	synchronized int live() {
		return live.size();
	}

	/** Retires every client. One still serving a call is closed when that call returns. */
	@Override
	public void close() {
		List<Entry> cleanup = new ArrayList<>();
		synchronized (this) {
			closed = true;
			current.clear();
			for (Entry entry : List.copyOf(live)) {
				retire(entry, cleanup);
			}
		}
		cleanup.forEach(ModelClients::dispose);
	}

	/** A borrowed client. Closing it gives the client back; closing twice does nothing. */
	final class Lease implements AutoCloseable {

		private final Entry entry;

		private final ChatModel model;

		private final AtomicBoolean released = new AtomicBoolean();

		private Lease(Entry entry, ChatModel model) {
			this.entry = entry;
			this.model = model;
		}

		ChatModel model() {
			return model;
		}

		@Override
		public void close() {
			if (released.compareAndSet(false, true)) {
				release(entry);
			}
		}

	}

	private static final class Entry {

		final String revision;

		final CompletableFuture<ChatModel> client = new CompletableFuture<>();

		int references;

		boolean retired;

		Entry(String revision) {
			this.revision = revision;
		}

	}

}
