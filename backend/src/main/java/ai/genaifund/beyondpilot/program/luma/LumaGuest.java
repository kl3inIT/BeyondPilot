package ai.genaifund.beyondpilot.program.luma;

import java.util.Optional;

import org.jspecify.annotations.Nullable;
import tools.jackson.databind.JsonNode;

/**
 * A guest of a Luma event (BEY-245).
 * @param id Luma's {@code gst-} identifier
 * @param checkIn the check-in address Luma's own email draws as a QR code; null while Luma gives none
 */
public record LumaGuest(String id, Status status, @Nullable String checkIn) {

	/** Where the guest stands, by the value Luma's API names it with. */
	public enum Status {

		PENDING_APPROVAL("pending_approval"), APPROVED("approved"), WAITLIST("waitlist"), DECLINED("declined"),
		INVITED("invited");

		private final String value;

		Status(String value) {
			this.value = value;
		}

		public String value() {
			return value;
		}

		/** Luma also says {@code session} of an approved guest of an event in several sessions. */
		static Optional<Status> of(@Nullable String value) {
			if ("session".equals(value)) {
				return Optional.of(APPROVED);
			}
			for (Status status : values()) {
				if (status.value.equals(value)) {
					return Optional.of(status);
				}
			}
			return Optional.empty();
		}

	}

	static Optional<LumaGuest> of(JsonNode node) {
		String id = LumaApi.text(node, "id");
		Optional<Status> status = Status.of(LumaApi.text(node, "approval_status"));
		if (id == null || status.isEmpty()) {
			return Optional.empty();
		}
		return Optional.of(new LumaGuest(id, status.get(), LumaApi.text(node, "check_in_qr_code")));
	}

}
