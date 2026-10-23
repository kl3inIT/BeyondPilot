package ai.genaifund.beyondpilot.program;

import java.io.IOException;
import java.net.URI;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Operator;
import ai.genaifund.beyondpilot.program.dto.ConnectLumaRequest;
import ai.genaifund.beyondpilot.program.dto.LumaConnectionResponse;
import ai.genaifund.beyondpilot.program.dto.LumaReadResponse;
import ai.genaifund.beyondpilot.program.luma.LumaApi;
import ai.genaifund.beyondpilot.program.luma.LumaProperties;
import ai.genaifund.beyondpilot.program.luma.LumaSignature;
import ai.genaifund.beyondpilot.program.persistence.LumaConnection;
import ai.genaifund.beyondpilot.program.persistence.LumaConnectionRepository;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * The Luma calendar BeyondPilot reads (BEY-245): an operator gives its key on the Luma tab of Programs, BeyondPilot
 * checks it, finds the calendar and makes a webhook on it, and the calendar is read at once and then every hour. Luma
 * is called outside any transaction; only what it answered is written.
 */
@Service
public class LumaAdministration {

	/** Where Luma sends its webhooks, under the site's public address. */
	public static final String WEBHOOK_PATH = "/api/program/luma/webhook";

	private static final Logger LOG = LoggerFactory.getLogger(LumaAdministration.class);

	private static final String CALENDAR = "luma_calendar";

	private final IdentityService identity;

	private final LumaConnectionRepository connections;

	private final LumaKeys keys;

	private final LumaCalendar calendar;

	private final LumaApi api;

	private final URI webhookUrl;

	private final AuditTrail audit;

	private final TransactionTemplate transactions;

	LumaAdministration(IdentityService identity, LumaConnectionRepository connections, LumaKeys keys,
			LumaCalendar calendar, LumaProperties properties, AuditTrail audit, TransactionTemplate transactions) {
		this.identity = identity;
		this.connections = connections;
		this.keys = keys;
		this.calendar = calendar;
		this.api = new LumaApi(properties.api(), properties.timeout());
		this.webhookUrl = UriComponentsBuilder.fromUri(properties.siteUrl()).path(WEBHOOK_PATH).build().toUri();
		this.audit = audit;
		this.transactions = transactions;
	}

	/** @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator */
	public LumaConnectionResponse connection(Actor actor) {
		identity.requireOperator(actor);
		return view(connections.current());
	}

	/**
	 * Connects the calendar of the key, replacing any connection before: the key is checked with Luma, sealed and kept,
	 * a webhook is made on the calendar, and the calendar is read soon after. A webhook that cannot be made is said on
	 * the connection; the hourly read goes on without it.
	 * @throws ProgramException when Luma refuses the key or cannot be reached, or no key can be kept here
	 */
	public LumaConnectionResponse connect(Actor actor, ConnectLumaRequest request) {
		Operator operator = identity.requireOperator(actor);
		String key = request.apiKey().strip();
		byte[] sealedKey = keys.seal(key);
		LumaApi.Calendar found;
		try {
			found = api.calendar(key);
		}
		catch (LumaApi.KeyRefused refused) {
			throw new ProgramException(ProgramErrorCode.LUMA_KEY_REFUSED, "Luma refused the key");
		}
		catch (IOException unreachable) {
			throw new ProgramException(ProgramErrorCode.LUMA_UNREACHABLE, "Luma could not be reached");
		}
		connections.current().ifPresent(this::removeWebhook);
		Hook hook = hook(key);
		Instant now = Instant.now();
		LumaConnection saved = transactions.execute(status -> {
			connections.current().ifPresent(held -> {
				connections.delete(held);
				connections.flush();
			});
			LumaConnection connection = new LumaConnection(sealedKey, ending(key), found.id(), found.name(),
					operator.accountId(), now);
			if (hook.id() != null && hook.secret() != null) {
				connection.hooked(hook.id(), keys.seal(hook.secret()), now);
			}
			else {
				connection.unhooked(hook.error() == null ? "No webhook was made" : hook.error(), now);
			}
			connections.save(connection);
			audit.record(new AuditRecord(AuditAction.PROGRAM_LUMA_CONNECT, actor(operator),
					new AuditRecord.Resource(CALENDAR, found.id(), found.name()), Map.of("calendar", found.name())));
			return connection;
		});
		calendar.readSoon();
		return view(Optional.ofNullable(saved));
	}

	/**
	 * Removes the key and the webhook made with it: the calendar is no longer read, and the programs it brought stay as
	 * they are. Removing when nothing is connected changes nothing.
	 */
	public void disconnect(Actor actor) {
		Operator operator = identity.requireOperator(actor);
		Optional<LumaConnection> held = connections.current();
		if (held.isEmpty()) {
			return;
		}
		removeWebhook(held.get());
		transactions.executeWithoutResult(status -> connections.current().ifPresent(connection -> {
			connections.delete(connection);
			audit.record(new AuditRecord(AuditAction.PROGRAM_LUMA_DISCONNECT, actor(operator),
					new AuditRecord.Resource(CALENDAR, connection.getCalendarId(), connection.getCalendarName()),
					Map.of("calendar", connection.getCalendarName())));
		}));
	}

	/**
	 * Reads the calendar now, as the hourly read does, for an operator who just published an event there. It runs
	 * without a transaction of its own: each event is written in its own, so one that fails leaves the others done. A
	 * read already running finishes first.
	 * @throws ProgramException when no calendar is connected, Luma refuses the key, or Luma could not be read
	 */
	public LumaReadResponse read(Actor actor) {
		Operator operator = identity.requireOperator(actor);
		LumaCalendar.Read read = calendar.read(Instant.now());
		switch (read.outcome()) {
			case NOT_CONNECTED -> throw new ProgramException(ProgramErrorCode.LUMA_NOT_CONFIGURED,
					"No Luma calendar is connected");
			case KEY_REFUSED -> throw new ProgramException(ProgramErrorCode.LUMA_KEY_REFUSED, "Luma refused the key");
			case UNREACHABLE -> throw new ProgramException(ProgramErrorCode.LUMA_UNREACHABLE,
					"The Luma calendar could not be read");
			case READ -> {
			}
		}
		String calendarName = connections.current().map(LumaConnection::getCalendarName).orElse("Luma");
		String calendarId = connections.current().map(LumaConnection::getCalendarId).orElse("luma");
		transactions.executeWithoutResult(status -> audit.record(new AuditRecord(AuditAction.PROGRAM_LUMA_READ,
				actor(operator), new AuditRecord.Resource(CALENDAR, calendarId, calendarName),
				Map.of("created", String.valueOf(read.created()), "updated", String.valueOf(read.updated()),
						"unpublished", String.valueOf(read.unpublished())))));
		return new LumaReadResponse(read.created(), read.updated(), read.unpublished(), read.failed());
	}

	/**
	 * Takes a delivery of Luma's webhook: one signed with the connection's secret makes the calendar be read soon, which
	 * is what any change of an event asks for, however many deliveries come and in whatever order.
	 * @return false when nothing is connected or the delivery is not signed by Luma
	 */
	public boolean receive(@Nullable String signature, byte[] body) {
		Optional<LumaConnection> held = connections.current();
		String secret = held.map(connection -> keys.open(connection.getWebhookSecret())).orElse(null);
		if (secret == null || !LumaSignature.valid(secret, signature, body, Instant.now())) {
			LOG.atWarn()
				.addKeyValue("event", "program.luma.webhook_refused")
				.log("A delivery to the Luma webhook was not signed by the connected calendar");
			return false;
		}
		calendar.readSoon();
		return true;
	}

	/** A webhook made on the calendar, or why none was. */
	private record Hook(@Nullable String id, @Nullable String secret, @Nullable String error) {
	}

	/** Makes the webhook, after removing one already pointing here, which a connection before left. */
	private Hook hook(String key) {
		try {
			for (LumaApi.Webhook webhook : api.webhooks(key)) {
				if (webhook.url().equals(webhookUrl.toString())) {
					api.deleteWebhook(key, webhook.id());
				}
			}
			LumaApi.Webhook made = api.createWebhook(key, webhookUrl);
			return new Hook(made.id(), made.secret(), null);
		}
		catch (IOException failed) {
			LOG.atWarn()
				.addKeyValue("event", "program.luma.webhook_failed")
				.addKeyValue("error_type", failed.getClass().getName())
				.log("No webhook could be made on the Luma calendar");
			return new Hook(null, null, "Luma did not make the webhook for " + webhookUrl);
		}
	}

	/** Removes the webhook a connection made, with its own key; one Luma no longer has, or cannot reach, is left. */
	private void removeWebhook(LumaConnection connection) {
		String key = keys.open(connection.getApiKey());
		String id = connection.getWebhookId();
		if (key == null || id == null) {
			return;
		}
		try {
			api.deleteWebhook(key, id);
		}
		catch (IOException failed) {
			LOG.atWarn()
				.addKeyValue("event", "program.luma.webhook_not_removed")
				.addKeyValue("error_type", failed.getClass().getName())
				.log("The webhook of the Luma calendar could not be removed");
		}
	}

	private LumaConnectionResponse view(Optional<LumaConnection> connection) {
		return new LumaConnectionResponse(keys.ready(),
				connection.map(held -> new LumaConnectionResponse.Calendar(held.getCalendarId(), held.getCalendarName(),
						held.getApiKeyEnding(), held.getWebhookId() != null, held.getWebhookError(), held.getCreatedAt(),
						held.getLastReadAt(), held.getLastReadError()))
					.orElse(null));
	}

	/** The last four characters of the key, which tell keys apart without being one. */
	private static String ending(String key) {
		return key.length() <= 8 ? "" : key.substring(key.length() - 4);
	}

	private static AuditRecord.Actor actor(Operator operator) {
		return new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email());
	}

}
