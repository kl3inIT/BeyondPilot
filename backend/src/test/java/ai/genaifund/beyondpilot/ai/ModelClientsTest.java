package ai.genaifund.beyondpilot.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;

/** The leased client cache alone: who gets which client, and when one is closed. */
class ModelClientsTest {

	@Test
	void callsOfOneKeyShareAClientUntilItsRevisionChanges() {
		try (ModelClients clients = new ModelClients(4)) {
			AtomicInteger built = new AtomicInteger();
			ModelClients.Lease first = clients.acquire("model", "1:1", () -> new Client(built));
			ModelClients.Lease second = clients.acquire("model", "1:1", () -> new Client(built));
			assertThat(second.model()).isSameAs(first.model());
			assertThat(built).hasValue(1);

			// The settings changed: the next call gets a new client, and the old one keeps serving its calls.
			ModelClients.Lease third = clients.acquire("model", "2:1", () -> new Client(built));
			assertThat(third.model()).isNotSameAs(first.model());
			assertThat(((Client) first.model()).closed).isFalse();
			first.close();
			assertThat(((Client) first.model()).closed).as("one call still holds it").isFalse();
			second.close();
			second.close();
			assertThat(((Client) first.model()).closed).as("closed when its last call returned").isTrue();
			assertThat(((Client) third.model()).closed).isFalse();
			third.close();
		}
	}

	@Test
	void aFullCacheGivesUpAnIdleClientAndRefusesWhenEveryOneIsInUse() {
		try (ModelClients clients = new ModelClients(2)) {
			AtomicInteger built = new AtomicInteger();
			ModelClients.Lease one = clients.acquire("one", "1", () -> new Client(built));
			ModelClients.Lease two = clients.acquire("two", "1", () -> new Client(built));
			assertThatThrownBy(() -> clients.acquire("three", "1", () -> new Client(built))).isInstanceOf(AiException.class)
				.extracting(failure -> ((AiException) failure).errorCode())
				.isEqualTo(AiErrorCode.BUSY);

			one.close();
			ModelClients.Lease three = clients.acquire("three", "1", () -> new Client(built));
			assertThat(((Client) one.model()).closed).as("the idle client made room").isTrue();
			assertThat(clients.live()).isEqualTo(2);
			two.close();
			three.close();
		}
	}

	@Test
	void aClientThatCannotBeBuiltLeavesNoSlotTaken() {
		try (ModelClients clients = new ModelClients(1)) {
			assertThatThrownBy(() -> clients.acquire("model", "1", () -> {
				throw new IllegalStateException("no connection");
			})).isInstanceOf(IllegalStateException.class);
			assertThat(clients.live()).isZero();

			clients.acquire("model", "1", () -> new Client(new AtomicInteger())).close();
		}
	}

	@Test
	void shuttingDownClosesIdleClientsAndLeavesOneInUseToItsCall() {
		ModelClients clients = new ModelClients(2);
		ModelClients.Lease idle = clients.acquire("idle", "1", () -> new Client(new AtomicInteger()));
		idle.close();
		ModelClients.Lease busy = clients.acquire("busy", "1", () -> new Client(new AtomicInteger()));

		clients.close();

		assertThat(((Client) idle.model()).closed).isTrue();
		assertThat(((Client) busy.model()).closed).isFalse();
		busy.close();
		assertThat(((Client) busy.model()).closed).isTrue();
		assertThatThrownBy(() -> clients.acquire("late", "1", () -> new Client(new AtomicInteger())))
			.isInstanceOf(AiException.class);
	}

	/** A client that says when it was closed. */
	private static final class Client implements ChatModel, AutoCloseable {

		volatile boolean closed;

		Client(AtomicInteger built) {
			built.incrementAndGet();
		}

		@Override
		public ChatResponse call(Prompt prompt) {
			throw new UnsupportedOperationException();
		}

		@Override
		public void close() {
			closed = true;
		}

	}

}
