package ai.genaifund.beyondpilot.search;

import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Supplier;

import org.springframework.stereotype.Component;

/**
 * One writer of the index at a time, between a rebuild and the listeners that keep the index current. A rebuild reads
 * what is published first and writes it after; a listener that took an item out in between would see it written back
 * as it was, so an item taken down would stay in search until the next rebuild. With the lock a listener waits for the
 * rebuild, then reads the item as it is now. A write that lands before the rebuild's transaction commits waits on its
 * row, so it applies after it.
 */
@Component
class IndexLock {

	private final ReentrantLock lock = new ReentrantLock();

	void run(Runnable work) {
		lock.lock();
		try {
			work.run();
		}
		finally {
			lock.unlock();
		}
	}

	<T> T call(Supplier<T> work) {
		lock.lock();
		try {
			return work.get();
		}
		finally {
			lock.unlock();
		}
	}

}
