package ai.genaifund.beyondpilot.program.dto;

import java.time.Instant;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "EventRegistration",
		description = "How to register for an event of GenAI Fund's Luma calendar on BeyondPilot, and the caller's registration.")
public record EventRegistrationResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "A mark of the questions as they stand; a registration sends it back.") String formVersion,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "open", "waitlist", "closed" },
				description = "`waitlist`: the event is full and a new registration joins its waitlist.") String state,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether GenAI Fund approves each guest.") boolean approval,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "Asia/Ho_Chi_Minh",
				description = "Where the event is held; its times read as that place's.") String zone,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> hosts,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "In Luma's order, those answered from the account included.") List<EventQuestionEntry> questions,
		@Schema(description = "The address of the venue; absent for an event online, or kept for confirmed guests.") @Nullable String venue,
		@Schema(description = "The address of the call; absent when there is none or it is kept for confirmed guests.") @Nullable String meetingUrl,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether Luma keeps the venue or the call for confirmed guests, and the caller is not one yet.") boolean placeKept,
		@Schema(description = "The caller's registration; absent when there is none or nobody is signed in.") @Nullable Mine mine) {

	@Schema(name = "MyEventRegistration")
	public record Mine(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					allowableValues = { "received", "pending_approval", "waitlist", "approved", "declined", "invited" },
					description = "`received` until Luma has the registration; then the guest's status on Luma.") String status,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant registeredAt,
			@Schema(description = "The image of the check-in QR code; only for a confirmed guest.", format = "uri") @Nullable String checkInImageUrl,
			@Schema(description = "The event as a calendar file; only for a confirmed guest.", format = "uri") @Nullable String calendarUrl) {
	}

}
