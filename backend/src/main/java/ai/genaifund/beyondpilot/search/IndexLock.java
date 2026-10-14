package ai.genaifund.beyondpilot.search;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Supplier;

import org.springframework.stereotype.Component;

/**
 * Keeps a rebuild from writing back what a listener changed while it ran. A rebuild reads what is published first and
 * writes it after, so an item taken down in between would be written back as it was and stay in search until the next
 * rebuild. A listener never waits for a rebuild, so a take-down leaves search at once; while a rebuild runs, its work is
 * also kept, and the rebuild does it again before it returns, inside its own transaction: the listener reads the item as
 * it is now, so what the rebuild commits is current.
 */
@Component
class IndexLock {

	/** One rebuild at a time. */
	private final ReentrantLock rebuilds = new ReentrantLock();

	/** Guards {@link #rebuilding} and {@link #again}. */
	private final Object state = new Object();

	private boolean rebuilding;

	private final List<Runnable> again = new ArrayList<>();

	/** A listener's change, done now, and done again at the end of a rebuild that is running. */
	void run(Runnable work) {
		synchronized (state) {
			if (rebuilding) {
				again.add(work);
			}
		}
		work.run();
	}

	/** A rebuild, after which every change listeners made meanwhile is done again on what is now published. */
	<T> T call(Supplier<T> rebuild) {
		rebuilds.lock();
		try {
			synchronized (state) {
				rebuilding = true;
			}
			try {
				T result = rebuild.get();
				while (true) {
					List<Runnable> pending;
					synchronized (state) {
						if (again.isEmpty()) {
							rebuilding = false;
							break;
						}
						pending = List.copyOf(again);
						again.clear();
					}
					pending.forEach(Runnable::run);
				}
				return result;
			}
			finally {
				synchronized (state) {
					rebuilding = false;
					again.clear();
				}
			}
		}
		finally {
			rebuilds.unlock();
		}
	}

}
