package ai.genaifund.beyondpilot.messaging.dto;

import java.util.Locale;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

/**
 * One thing that happened in the caller's conversations, as the stream of events sends it: the kind is the name of the
 * event, and this is its body.
 */
@Schema(name = "MessagingEvent",
		description = "The body of one event of the caller's stream. The name of the event says what happened.")
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MessagingEvent(@JsonIgnore @Schema(hidden = true) Kind kind,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID conversationId,
		@Schema(description = "The message that was written, on a `message` event.") @Nullable MessageResponse message,
		@Schema(description = "How far the reader has read, on a `read` event.") @Nullable Long seq,
		@Schema(description = "On a `read` event, whether the person who started the conversation is the reader; on a `typing` event, whether they are the one writing.") @Nullable Boolean fromStarter,
		@Schema(description = "On a `read` event, whether the caller is the reader, on another screen.") @Nullable Boolean mine,
		@Schema(description = "Who is writing, on a `typing` event; absent until they gave a name.") @Nullable String name) {

	/** What happened. The name of the event is the constant in lower case. */
	public enum Kind {

		/** A message was written. */
		MESSAGE,

		/** Someone read up to a message. */
		READ,

		/** Someone on the other side is writing. */
		TYPING,

		/** A conversation started, was answered or closed: its row and its state are read again. */
		CONVERSATION;

		public String eventName() {
			return name().toLowerCase(Locale.ROOT);
		}

	}

}
