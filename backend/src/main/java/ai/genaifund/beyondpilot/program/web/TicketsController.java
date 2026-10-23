package ai.genaifund.beyondpilot.program.web;

import ai.genaifund.beyondpilot.program.EventRegistrations;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * A confirmed guest's check-in code and calendar file, read by the unguessable ticket an email links to (BEY-245), so a
 * mail client shows the code without the person signing in. Any other ticket is not found.
 */
@RestController
@RequestMapping("/api/program/tickets/{ticket}")
@Tag(name = "Programs")
class TicketsController {

	private static final MediaType CALENDAR = MediaType.parseMediaType("text/calendar;charset=UTF-8");

	/** The code is the guest's own; a shared cache never keeps it. */
	private static final CacheControl PRIVATE = CacheControl.noStore();

	private final EventRegistrations registrations;

	TicketsController(EventRegistrations registrations) {
		this.registrations = registrations;
	}

	@GetMapping(path = "/check-in.png", produces = MediaType.IMAGE_PNG_VALUE)
	@Operation(operationId = "getCheckInCode", summary = "A confirmed guest's check-in QR code")
	@ApiResponse(responseCode = "200", description = "The code as a PNG image.",
			content = @Content(mediaType = MediaType.IMAGE_PNG_VALUE, schema = @Schema(type = "string", format = "binary")))
	@ApiResponse(responseCode = "404", description = "No confirmed guest holds this ticket, or Luma gave no code.")
	ResponseEntity<byte[]> checkIn(@PathVariable String ticket) {
		return registrations.checkInImage(ticket)
			.map(png -> ResponseEntity.ok().cacheControl(PRIVATE).contentType(MediaType.IMAGE_PNG).body(png))
			.orElseGet(() -> ResponseEntity.notFound().build());
	}

	@GetMapping(path = "/event.ics", produces = "text/calendar")
	@Operation(operationId = "getEventCalendarFile", summary = "The event as a calendar file, for a confirmed guest")
	@ApiResponse(responseCode = "200", description = "An iCalendar file with the event, its time and its place.",
			content = @Content(mediaType = "text/calendar", schema = @Schema(type = "string")))
	@ApiResponse(responseCode = "404", description = "No confirmed guest holds this ticket.")
	ResponseEntity<String> calendar(@PathVariable String ticket) {
		return registrations.calendarFile(ticket)
			.map(file -> ResponseEntity.ok()
				.cacheControl(PRIVATE)
				.contentType(CALENDAR)
				.header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"event.ics\"")
				.body(file))
			.orElseGet(() -> ResponseEntity.notFound().build());
	}

}
