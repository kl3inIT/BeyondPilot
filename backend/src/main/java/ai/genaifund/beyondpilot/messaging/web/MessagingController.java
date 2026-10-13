package ai.genaifund.beyondpilot.messaging.web;

import java.time.Duration;
import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.messaging.MessagingService;
import ai.genaifund.beyondpilot.messaging.dto.ConversationDetailResponse;
import ai.genaifund.beyondpilot.messaging.dto.ConversationListResponse;
import ai.genaifund.beyondpilot.messaging.dto.MarkReadRequest;
import ai.genaifund.beyondpilot.messaging.dto.MessageListRequest;
import ai.genaifund.beyondpilot.messaging.dto.MessagePageResponse;
import ai.genaifund.beyondpilot.messaging.dto.MessageResponse;
import ai.genaifund.beyondpilot.messaging.dto.MessagingEvent;
import ai.genaifund.beyondpilot.messaging.dto.ProspectRequest;
import ai.genaifund.beyondpilot.messaging.dto.ProspectResponse;
import ai.genaifund.beyondpilot.messaging.dto.SendMessageRequest;
import ai.genaifund.beyondpilot.messaging.dto.StartConversationRequest;
import ai.genaifund.beyondpilot.messaging.dto.UnreadResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

/**
 * A signed-in person's conversations: the lists, one conversation, the messages written in it, and the stream of what
 * happens while a screen is open.
 */
@RestController
@RequestMapping("/api/messaging")
@Tag(name = "Messaging",
		description = "Conversations with the person behind a talent profile, the organization that offers a solution, and GenAI Fund about a program.")
@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = MessagingController.PROBLEM)))
class MessagingController {

	static final String PROBLEM = "#/components/schemas/Problem";

	private static final String PROBLEM_JSON = MediaType.APPLICATION_PROBLEM_JSON_VALUE;

	/** A line the browser ignores, sent this often so that no proxy on the way closes a stream that says nothing. */
	private static final Duration HEARTBEAT = Duration.ofSeconds(20);

	private final MessagingService messaging;

	MessagingController(MessagingService messaging) {
		this.messaging = messaging;
	}

	@GetMapping(path = "/conversations", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listConversations", summary = "The caller's conversations, the one written in last first",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The open conversations and the first messages that wait.")
	ConversationListResponse list(@CurrentActor Actor actor) {
		return messaging.list(actor);
	}

	@GetMapping(path = "/unread", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getUnreadMessages",
			summary = "How many messages the caller has not read, and how many first messages wait for their answer",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "What waits for the caller in Messages.")
	UnreadResponse unread(@CurrentActor Actor actor) {
		return messaging.unread(actor);
	}

	@GetMapping(path = "/prospect", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getConversationProspect",
			summary = "Who the caller would write to at a public address, before anything is written",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200",
			description = "What it is about, who reads it, and the conversation the caller already has there.")
	@ApiResponse(responseCode = "400", description = "A parameter is not valid.",
			content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403",
			description = "The caller belongs to no approved organization and means to write to a solution provider.",
			content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "No profile, solution or program is at the address.",
			content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The address is the caller's own.",
			content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM)))
	ProspectResponse prospect(@CurrentActor Actor actor, @Valid @ParameterObject ProspectRequest request) {
		return messaging.prospect(actor, request);
	}

	@PostMapping(path = "/conversations", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "startConversation", summary = "Write a first message",
			description = "To a person or an organization the message waits as a request until the other side accepts, declines or reports it. "
					+ "To GenAI Fund the conversation is open at once. A caller who already talks with the other side writes in that conversation instead.",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The conversation with the message in it.")
	@ApiResponse(responseCode = "400", description = "The request is not valid.",
			content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403",
			description = "The caller belongs to no approved organization and writes to a solution provider.",
			content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "No profile, solution or program is at the address.",
			content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409",
			description = "The address is the caller's own, or their earlier first message still waits for an answer.",
			content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "429", description = "The caller started as many conversations as a day allows.",
			content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM)))
	ConversationDetailResponse start(@CurrentActor Actor actor, @Valid @RequestBody StartConversationRequest request) {
		return messaging.start(actor, request);
	}

	@GetMapping(path = "/conversations/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getConversation",
			summary = "One conversation with its latest messages, what it is about and who is on the other side",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The conversation.")
	@ApiResponse(responseCode = "404", description = "The caller has no such conversation.",
			content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM)))
	ConversationDetailResponse get(@CurrentActor Actor actor, @PathVariable UUID id) {
		return messaging.get(actor, id);
	}

	@GetMapping(path = "/conversations/{id}/messages", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listMessages",
			summary = "Some messages of a conversation: those before one, to read further back, or those after one, to catch up",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "At most 50 messages, the oldest first.")
	@ApiResponse(responseCode = "400", description = "A parameter is not valid.",
			content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "The caller has no such conversation.",
			content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM)))
	MessagePageResponse messages(@CurrentActor Actor actor, @PathVariable UUID id,
			@Valid @ParameterObject MessageListRequest request) {
		return messaging.messages(actor, id, request);
	}

	@PostMapping(path = "/conversations/{id}/messages", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "sendMessage", summary = "Write a message in an open conversation",
			description = "The sender chooses the message's identifier, so a send that got no answer is safe to repeat: the message is written once.",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The message as it was kept.")
	@ApiResponse(responseCode = "400", description = "The request is not valid.",
			content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "The caller has no such conversation.",
			content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409",
			description = "The conversation is not open, or the identifier belongs to another message.",
			content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "429", description = "The caller writes too fast.",
			content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM)))
	MessageResponse send(@CurrentActor Actor actor, @PathVariable UUID id,
			@Valid @RequestBody SendMessageRequest request) {
		return messaging.send(actor, id, request);
	}

	@PostMapping(path = "/conversations/{id}/read", consumes = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "markConversationRead", summary = "Say how far the caller has read a conversation",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "It is recorded, and the other side is told.", content = @Content)
	@ApiResponse(responseCode = "400", description = "The request is not valid.",
			content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "The caller has no such conversation.",
			content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM)))
	void read(@CurrentActor Actor actor, @PathVariable UUID id, @Valid @RequestBody MarkReadRequest request) {
		messaging.read(actor, id, request);
	}

	@PostMapping(path = "/conversations/{id}/typing")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "sayTyping", summary = "Tell the others of an open conversation that the caller is writing",
			description = "Nothing is kept. A screen says it again every few seconds while its person writes.",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The others with a screen open are told.", content = @Content)
	@ApiResponse(responseCode = "404", description = "The caller has no such conversation.",
			content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM)))
	void typing(@CurrentActor Actor actor, @PathVariable UUID id) {
		messaging.typing(actor, id);
	}

	@PostMapping(path = "/conversations/{id}/accept", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "acceptConversation", summary = "Accept a first message, which opens the conversation",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The conversation is open, and the sender is told.")
	@ApiResponse(responseCode = "403", description = "Only an owner of the organization answers.",
			content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "No such request waits for the caller's side.",
			content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "It was answered already.",
			content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM)))
	ConversationDetailResponse accept(@CurrentActor Actor actor, @PathVariable UUID id) {
		return messaging.accept(actor, id);
	}

	@PostMapping(path = "/conversations/{id}/decline", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "declineConversation", summary = "Decline a first message",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "It is declined, and the sender is told without a reason.",
			content = @Content)
	@ApiResponse(responseCode = "403", description = "Only an owner of the organization answers.",
			content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "No such request waits for the caller's side.",
			content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "It was answered already.",
			content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM)))
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void decline(@CurrentActor Actor actor, @PathVariable UUID id) {
		messaging.decline(actor, id);
	}

	@PostMapping(path = "/conversations/{id}/report")
	@Operation(operationId = "reportConversation", summary = "Report a first message as unwanted",
			description = "The sender is told what a decline tells. Operators read what was reported.",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "It is reported.", content = @Content)
	@ApiResponse(responseCode = "403", description = "Only an owner of the organization answers.",
			content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "No such request waits for the caller's side.",
			content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "It was answered already.",
			content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(ref = PROBLEM)))
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void report(@CurrentActor Actor actor, @PathVariable UUID id) {
		messaging.report(actor, id);
	}

	@GetMapping(path = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
	@Operation(operationId = "streamMessagingEvents",
			summary = "Hear what happens in the caller's conversations, for as long as the connection stays open",
			description = "Server-sent events. The name of an event says what happened: `message` (a message was written; the body carries it), "
					+ "`read` (someone read up to a message), `typing` (someone on the other side is writing) and `conversation` "
					+ "(a conversation started, was answered or closed: read it and the list again). "
					+ "Nothing is replayed, so read `listConversations`, and `listMessages` after the last message held, whenever the connection opens. "
					+ "The server ends the stream after ten minutes; open it again. A comment line is sent when the stream opens and every 20 seconds.",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The stream; the schema is the body of each event.",
			content = @Content(mediaType = MediaType.TEXT_EVENT_STREAM_VALUE,
					schema = @Schema(implementation = MessagingEvent.class)))
	ResponseEntity<Flux<ServerSentEvent<MessagingEvent>>> events(@CurrentActor Actor actor) {
		Flux<ServerSentEvent<MessagingEvent>> events = messaging.events(actor)
			.map(event -> ServerSentEvent.builder(event).event(event.kind().eventName()).build());
		// The first comment leaves at once, after the events are listened to: the browser then knows the stream is
		// open, and what it reads next misses nothing.
		Flux<ServerSentEvent<MessagingEvent>> alive = Flux.interval(Duration.ZERO, HEARTBEAT)
			.map(tick -> ServerSentEvent.<MessagingEvent>builder().comment("alive").build());
		return ResponseEntity.ok()
			// The reverse proxy is nginx, which holds a response back until it is told not to.
			.header(HttpHeaders.CACHE_CONTROL, "no-store")
			.header("X-Accel-Buffering", "no")
			.body(events.mergeWith(alive).take(MessagingService.STREAM_LIFETIME));
	}

}
