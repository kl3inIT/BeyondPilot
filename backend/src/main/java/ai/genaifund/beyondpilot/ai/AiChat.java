package ai.genaifund.beyondpilot.ai;

import org.springframework.ai.chat.client.ChatClient;

/**
 * A task's chat client, borrowed for one piece of work. Closing it gives the client back; until then a change of
 * settings does not cut the work short. Every call made through it is recorded.
 */
public final class AiChat implements AutoCloseable {

	private final ChatClient client;

	private final String modelName;

	private final Runnable release;

	AiChat(ChatClient client, String modelName, Runnable release) {
		this.client = client;
		this.modelName = modelName;
		this.release = release;
	}

	public ChatClient client() {
		return client;
	}

	/** The model in use, as its provider names it. */
	public String modelName() {
		return modelName;
	}

	@Override
	public void close() {
		release.run();
	}

}
