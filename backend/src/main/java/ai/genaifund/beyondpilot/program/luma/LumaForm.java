package ai.genaifund.beyondpilot.program.luma;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

import org.jspecify.annotations.Nullable;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * How people register for an event GenAI Fund manages on Luma, when they can do it on BeyondPilot (BEY-245): whether
 * Luma takes registrations, whether each waits for approval, the seats and the waitlist, and the questions. Also what
 * only a confirmed guest is shown of the place. An event another host lists, a paid one, and one that asks a question
 * BeyondPilot does not know has none: people register on Luma.
 * @param open whether Luma takes registrations now
 * @param approval whether GenAI Fund approves each guest
 * @param seatsLeft the seats still free; null when the event has no limit
 * @param waitlist whether a full event puts new guests on its waitlist
 * @param hosts the hosts, as Luma shows them
 * @param zone where the event is held, so its times read as that place's
 * @param venue the full address; null for an event online or without one
 * @param meetingUrl the call's address for an event online; null when there is none
 * @param placeForGuests whether Luma shows the venue or the call only to a confirmed guest
 */
public record LumaForm(boolean open, boolean approval, @Nullable Integer seatsLeft, boolean waitlist,
		List<LumaQuestion> questions, List<LumaHost> hosts, String zone, @Nullable String venue,
		@Nullable String meetingUrl, boolean placeForGuests) {

	private static final JsonMapper JSON = JsonMapper.builder().build();

	/** Whether a person can register now, and how. */
	public enum State {
		OPEN, WAITLIST, CLOSED
	}

	public State state() {
		if (!open) {
			return State.CLOSED;
		}
		if (seatsLeft != null && seatsLeft <= 0) {
			return waitlist ? State.WAITLIST : State.CLOSED;
		}
		return State.OPEN;
	}

	/**
	 * The status a new guest is added to Luma with: on the waitlist of a full event, waiting for approval when GenAI
	 * Fund approves each, approved otherwise. Empty when the event takes no registration.
	 */
	public Optional<LumaGuest.Status> statusOnAdding() {
		return switch (state()) {
			case CLOSED -> Optional.empty();
			case WAITLIST -> Optional.of(LumaGuest.Status.WAITLIST);
			case OPEN -> Optional.of(approval ? LumaGuest.Status.PENDING_APPROVAL : LumaGuest.Status.APPROVED);
		};
	}

	/**
	 * A short mark of the questions as they stand. A form sent with another mark was filled against questions the host
	 * has changed since.
	 */
	public String version() {
		try {
			byte[] digest = MessageDigest.getInstance("SHA-256")
				.digest(JSON.writeValueAsString(questions).getBytes(StandardCharsets.UTF_8));
			return HexFormat.of().formatHex(digest, 0, 8);
		}
		catch (NoSuchAlgorithmException absent) {
			throw new IllegalStateException(absent);
		}
	}

	public Optional<LumaQuestion> question(String id) {
		return questions.stream().filter(question -> question.id().equals(id)).findFirst();
	}

	/** The form as the program keeps it. */
	public String json() {
		return JSON.writeValueAsString(this);
	}

	/** The form a program keeps; empty when it keeps none or one written before a change of its shape. */
	public static Optional<LumaForm> parse(@Nullable String json) {
		if (json == null) {
			return Optional.empty();
		}
		try {
			return Optional.of(JSON.readValue(json, LumaForm.class));
		}
		catch (JacksonException unreadable) {
			return Optional.empty();
		}
	}

	/**
	 * The form of an event as Luma's API gives it; empty when people cannot register for it on BeyondPilot: another host
	 * manages it, it has a price, or it asks a question BeyondPilot does not know.
	 */
	static Optional<LumaForm> of(JsonNode node, String zone) {
		JsonNode price = node.path("display_price");
		boolean paid = !price.isNull() && !price.isMissingNode();
		if (!"manage".equals(LumaApi.text(node, "access")) || paid || !node.path("registration_questions").isArray()) {
			return Optional.empty();
		}
		List<LumaQuestion> questions = new ArrayList<>();
		for (JsonNode question : node.path("registration_questions")) {
			Optional<LumaQuestion.Type> type = LumaQuestion.Type.of(LumaApi.text(question, "question_type"));
			if (type.isEmpty()) {
				return Optional.empty();
			}
			LumaQuestion.of(question, type.get()).ifPresent(questions::add);
		}
		List<LumaHost> hosts = new ArrayList<>();
		for (JsonNode host : node.path("hosts")) {
			String name = LumaApi.text(host, "name");
			if (name != null) {
				String avatar = LumaApi.text(host, "avatar_url");
				hosts.add(new LumaHost(name, avatar != null && avatar.startsWith("https://") ? avatar : null));
			}
		}
		JsonNode seats = node.path("spots_remaining");
		JsonNode address = node.path("geo_address_json");
		String venue = LumaApi.text(address, "full_address");
		return Optional.of(new LumaForm(node.path("registration_open").asBoolean(false),
				node.path("require_approval").asBoolean(false), seats.isNumber() ? seats.asInt() : null,
				"enabled".equals(LumaApi.text(node, "waitlist_status")), List.copyOf(questions), List.copyOf(hosts),
				zone, venue == null ? LumaApi.text(address, "address") : venue, LumaApi.text(node, "meeting_url"),
				"guests-only".equals(LumaApi.text(node, "location_visibility"))));
	}

}
