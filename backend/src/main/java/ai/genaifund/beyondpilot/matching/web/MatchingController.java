package ai.genaifund.beyondpilot.matching.web;

import java.time.Duration;
import java.util.Locale;
import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.matching.MatchingService;
import ai.genaifund.beyondpilot.matching.dto.AddCandidateRequest;
import ai.genaifund.beyondpilot.matching.dto.MatchingChange;
import ai.genaifund.beyondpilot.matching.dto.MatchingResponse;
import ai.genaifund.beyondpilot.matching.dto.RemoveCandidateRequest;
import ai.genaifund.beyondpilot.matching.dto.StartRunRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

/**
 * The solutions matched to a use case, for the members of its organization and for operators. Every answer is the
 * whole state after the request, so a screen shows what was kept. A screen that stays open listens to the stream of
 * changes and reads the state again when one arrives.
 */
@RestController
@RequestMapping("/api/matching")
@Tag(name = "Matching", description = "The solutions that fit a use case, with the reasons, and what people decide on them.")
@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = MatchingController.PROBLEM)))
class MatchingController {

	static final String PROBLEM = "#/components/schemas/Problem";

	/** A line the browser ignores, sent this often so that no proxy on the way closes a stream that says nothing. */
	private static final Duration HEARTBEAT = Duration.ofSeconds(20);

	private final MatchingService matching;

	MatchingController(MatchingService matching) {
		this.matching = matching;
	}

	@GetMapping(path = "/use-cases/{useCaseId}", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getMatching", summary = "The candidates of a use case, with its requirements and its last run",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "What matching holds for the use case.")
	@ApiResponse(responseCode = "404",
			description = "No published use case has the identifier, or the caller is neither an operator nor a member of its organization.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	MatchingResponse get(@CurrentActor Actor actor, @PathVariable UUID useCaseId) {
		return matching.get(actor, useCaseId);
	}

	@GetMapping(path = "/use-cases/{useCaseId}/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
	@Operation(operationId = "streamMatchingChanges",
			summary = "Hear that what matching holds for a use case changed, for as long as the connection stays open",
			description = "Server-sent events. The name of an event says what changed: `run` (a run was queued, started, has to wait, ended or failed), "
					+ "`brief` (the requirements are read), `found` (the solutions are found), `reading` (the judgment of one solution starts), "
					+ "`read` (the judgment of one solution ended) and `decision` (a person shortlisted, removed, restored or added a solution). "
					+ "An event carries no state: read `getMatching` again. Nothing is replayed, so read it once whenever the connection opens. "
					+ "A comment line is sent when the stream opens and every 20 seconds.",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The stream; the schema is the body of each event.",
			content = @Content(mediaType = MediaType.TEXT_EVENT_STREAM_VALUE,
					schema = @Schema(implementation = MatchingChange.class)))
	@ApiResponse(responseCode = "404",
			description = "No published use case has the identifier, or the caller is neither an operator nor a member of its organization.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ResponseEntity<Flux<ServerSentEvent<MatchingChange>>> changes(@CurrentActor Actor actor,
			@PathVariable UUID useCaseId) {
		Flux<ServerSentEvent<MatchingChange>> changes = matching.changes(actor, useCaseId)
			.map(change -> ServerSentEvent.builder(change)
				.event(change.kind().name().toLowerCase(Locale.ROOT))
				.build());
		// The first comment leaves at once, after the changes are listened to: the browser then knows the stream is
		// open, and what it reads next misses nothing.
		Flux<ServerSentEvent<MatchingChange>> alive = Flux.interval(Duration.ZERO, HEARTBEAT)
			.map(tick -> ServerSentEvent.<MatchingChange>builder().comment("alive").build());
		return ResponseEntity.ok()
			// The reverse proxy is nginx, which holds a response back until it is told not to.
			.header(HttpHeaders.CACHE_CONTROL, "no-store")
			.header("X-Accel-Buffering", "no")
			.body(changes.mergeWith(alive));
	}

	@PostMapping(path = "/use-cases/{useCaseId}/runs", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "startMatchingRun", summary = "Start a run of matching for a use case",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The run is queued, or the run that waited starts now.")
	@ApiResponse(responseCode = "403", description = "Only an operator has every candidate judged again.", content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "The use case is unknown to the caller.", content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "A run is at work for the use case.", content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "429", description = "Members started as many runs as a day allows.", content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "503", description = "No AI model is set for matching.", content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	MatchingResponse start(@CurrentActor Actor actor, @PathVariable UUID useCaseId,
			@Valid @RequestBody StartRunRequest request) {
		return matching.start(actor, useCaseId, request);
	}

	@PostMapping(path = "/use-cases/{useCaseId}/candidates", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "addMatchingCandidate", summary = "Put a solution among the candidates by hand",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The solution is a candidate; the next run judges it.")
	@ApiResponse(responseCode = "400", description = "The request is not valid.", content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = "The caller is not an operator.", content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "The use case or the approved solution is unknown.", content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409",
			description = "The solution is a candidate already, or belongs to the organization of the use case.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	MatchingResponse add(@CurrentActor Actor actor, @PathVariable UUID useCaseId,
			@Valid @RequestBody AddCandidateRequest request) {
		return matching.add(actor, useCaseId, request);
	}

	@PostMapping(path = "/candidates/{candidateId}/shortlist", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "shortlistMatchingCandidate", summary = "Put a candidate on the shortlist",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The candidate is on the shortlist.")
	@ApiResponse(responseCode = "404", description = "The candidate is unknown to the caller.", content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The candidate was removed.", content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	MatchingResponse shortlist(@CurrentActor Actor actor, @PathVariable UUID candidateId) {
		return matching.shortlist(actor, candidateId);
	}

	@PostMapping(path = "/candidates/{candidateId}/remove", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "removeMatchingCandidate", summary = "Take a candidate off the list, with the reason",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The candidate is removed, and off the shortlist.")
	@ApiResponse(responseCode = "400", description = "The reason is not valid, or is other and nothing says what.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "The candidate is unknown to the caller.", content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	MatchingResponse remove(@CurrentActor Actor actor, @PathVariable UUID candidateId,
			@Valid @RequestBody RemoveCandidateRequest request) {
		return matching.remove(actor, candidateId, request);
	}

	@PostMapping(path = "/candidates/{candidateId}/restore", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "restoreMatchingCandidate",
			summary = "Put a candidate back as nobody had decided on it: off the shortlist, or back on the list",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "Nothing is decided on the candidate.")
	@ApiResponse(responseCode = "403", description = "GenAI Fund removed the candidate and the caller is a member.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "The candidate is unknown to the caller.", content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	MatchingResponse restore(@CurrentActor Actor actor, @PathVariable UUID candidateId) {
		return matching.restore(actor, candidateId);
	}

}
