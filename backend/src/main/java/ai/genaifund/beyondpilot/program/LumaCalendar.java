package ai.genaifund.beyondpilot.program;

import java.io.IOException;
import java.net.URI;
import java.text.Normalizer;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.locks.ReentrantLock;
import java.util.stream.Collectors;

import jakarta.annotation.PreDestroy;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.program.luma.LumaApi;
import ai.genaifund.beyondpilot.program.luma.LumaEvent;
import ai.genaifund.beyondpilot.program.luma.LumaForm;
import ai.genaifund.beyondpilot.program.luma.LumaHttp;
import ai.genaifund.beyondpilot.program.luma.LumaProperties;
import ai.genaifund.beyondpilot.program.persistence.LumaConnection;
import ai.genaifund.beyondpilot.program.persistence.LumaConnectionRepository;
import ai.genaifund.beyondpilot.program.persistence.PageKind;
import ai.genaifund.beyondpilot.program.persistence.Program;
import ai.genaifund.beyondpilot.program.persistence.ProgramEvent;
import ai.genaifund.beyondpilot.program.persistence.ProgramRepository;
import ai.genaifund.beyondpilot.program.persistence.ProgramType;
import ai.genaifund.beyondpilot.storage.FilePurpose;
import ai.genaifund.beyondpilot.storage.StorageService;
import ai.genaifund.beyondpilot.storage.StoredFile;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Brings the events of the connected Luma calendar onto the site through Luma's API (BEY-190, BEY-245). Each event
 * still to come is a program of type event; its page is here when people register for it here, Luma's otherwise.
 * Luma owns what it supplies, so a change there overwrites an operator's edit at the next read, and a read that
 * changes nothing writes nothing. A public event is published; a private or members-only one waits as a draft for
 * an operator. The job never changes the status of a program it already holds, except to unpublish one whose future
 * event left the calendar. It reads every hour, and soon after Luma's webhook says an event changed; with no
 * calendar connected it does nothing.
 */
@Component
@EnableScheduling
@EnableConfigurationProperties(LumaProperties.class)
class LumaCalendar {

	private static final Logger LOG = LoggerFactory.getLogger(LumaCalendar.class);

	private static final String PROGRAM = "program";

	/** As many as storage keeps of a program's image by default; storage checks its own setting again. */
	private static final int MAX_IMAGE_BYTES = 5 * 1024 * 1024;

	private static final int MAX_NAME = 120;

	private static final int MAX_SUMMARY = 300;

	private static final int MAX_ABOUT = 20_000;

	private static final int MAX_EVENT_TITLE = 160;

	private static final int MAX_SLUG = 60;

	/** How long an event just created waits for a read of the whole calendar before leaving the event to it. */
	private static final long BRING_WAIT_SECONDS = 3;

	private final LumaProperties properties;

	private final LumaApi api;

	private final LumaHttp http;

	private final LumaKeys keys;

	private final LumaConnectionRepository connections;

	private final ProgramRepository programs;

	private final StorageService storage;

	private final AuditTrail audit;

	private final ApplicationEventPublisher events;

	private final TransactionTemplate transactions;

	/** Runs the reads a webhook asks for, one at a time and away from the request. */
	private final ExecutorService soon = Executors.newSingleThreadExecutor(Thread.ofVirtual().name("luma-read").factory());

	private final AtomicBoolean queued = new AtomicBoolean();

	/** Held by one read or one bring at a time, so two never write the same event together. */
	private final ReentrantLock reading = new ReentrantLock();

	LumaCalendar(LumaProperties properties, LumaKeys keys, LumaConnectionRepository connections,
			ProgramRepository programs, StorageService storage, AuditTrail audit, ApplicationEventPublisher events,
			TransactionTemplate transactions) {
		this.properties = properties;
		this.api = new LumaApi(properties.api(), properties.timeout());
		this.http = new LumaHttp(properties.hosts(), properties.timeout());
		this.keys = keys;
		this.connections = connections;
		this.programs = programs;
		this.storage = storage;
		this.audit = audit;
		this.events = events;
		this.transactions = transactions;
	}

	@Scheduled(fixedDelayString = "${beyondpilot.program.luma.interval:1h}", initialDelay = 120_000)
	void readEveryHour() {
		read(Instant.now());
	}

	/** Reads the calendar soon, once however many deliveries ask while a read waits. */
	void readSoon() {
		if (queued.compareAndSet(false, true)) {
			soon.execute(() -> {
				queued.set(false);
				read(Instant.now());
			});
		}
	}

	@PreDestroy
	void stop() {
		soon.shutdownNow();
	}

	/** Why a read changed nothing, when it could not read the calendar. */
	enum Outcome {
		READ, NOT_CONNECTED, KEY_REFUSED, UNREACHABLE
	}

	/** What one read changed. */
	record Read(int created, int updated, int unpublished, int failed, Outcome outcome) {

		static Read not(Outcome outcome) {
			return new Read(0, 0, 0, 0, outcome);
		}

	}

	private enum Change {
		CREATED, UPDATED, UNCHANGED
	}

	/**
	 * Reads the calendar and brings each event still to come onto the site, each in a transaction of its own, so one
	 * that fails leaves the others done and is tried again at the next read. A calendar that cannot be read changes
	 * nothing. One read runs at a time: an operator's read waits for the hourly one, so the two never write the same
	 * event together.
	 */
	Read read(Instant now) {
		reading.lock();
		try {
			return readHeld(now);
		}
		finally {
			reading.unlock();
		}
	}

	private Read readHeld(Instant now) {
		Optional<LumaConnection> connection = connections.current();
		if (connection.isEmpty()) {
			return Read.not(Outcome.NOT_CONNECTED);
		}
		String key = keys.open(connection.get().getApiKey());
		if (key == null) {
			return finished(Read.not(Outcome.NOT_CONNECTED), now, "This environment cannot open the key");
		}
		List<LumaEvent> calendar;
		try {
			calendar = api.events(key);
		}
		catch (LumaApi.KeyRefused refused) {
			return finished(Read.not(Outcome.KEY_REFUSED), now, "Luma refused the key");
		}
		catch (IOException failed) {
			LOG.atWarn()
				.addKeyValue("event", "program.luma.read_failed")
				.addKeyValue("error_type", failed.getClass().getName())
				.log("The Luma calendar could not be read");
			return finished(Read.not(Outcome.UNREACHABLE), now, "Luma could not be read");
		}
		int created = 0;
		int updated = 0;
		int failed = 0;
		for (LumaEvent listed : calendar) {
			if (listed.over(now)) {
				continue;
			}
			try {
				LumaEvent event = api.event(key, listed.id()).orElse(listed);
				switch (take(event)) {
					case CREATED -> created++;
					case UPDATED -> updated++;
					case UNCHANGED -> {
					}
				}
			}
			catch (IOException | RuntimeException failure) {
				failed++;
				LOG.atWarn()
					.addKeyValue("event", "program.luma.event_failed")
					.addKeyValue("luma_event_id", listed.id())
					.addKeyValue("error_type", failure.getClass().getName())
					.log("A Luma event could not be brought onto the site");
			}
		}
		int unpublished = unpublishRemoved(calendar.stream().map(LumaEvent::id).collect(Collectors.toSet()), now);
		Read read = new Read(created, updated, unpublished, failed, Outcome.READ);
		if (created + updated + unpublished + failed > 0) {
			LOG.atInfo()
				.addKeyValue("event", "program.luma.read")
				.addKeyValue("created", created)
				.addKeyValue("updated", updated)
				.addKeyValue("unpublished", unpublished)
				.addKeyValue("failed", failed)
				.log("The Luma calendar was read");
		}
		return finished(read, now, null);
	}

	/**
	 * Brings one event of the calendar onto the site at once, as a read does, for an event just created from
	 * BeyondPilot (BEY-250). It waits a few seconds at most for a read of the whole calendar, which Luma's webhook for
	 * the new event may have started, so the operator's app is not held while every event is read; the next read brings
	 * the event then.
	 * @return the program that holds it; empty when Luma has no such event, or when a read held the calendar too long
	 */
	Optional<UUID> bring(String key, String eventId) throws IOException {
		try {
			if (!reading.tryLock(BRING_WAIT_SECONDS, TimeUnit.SECONDS)) {
				return Optional.empty();
			}
		}
		catch (InterruptedException interrupted) {
			Thread.currentThread().interrupt();
			return Optional.empty();
		}
		try {
			Optional<LumaEvent> event = api.event(key, eventId);
			if (event.isEmpty()) {
				return Optional.empty();
			}
			take(event.get());
			return programs.findByLumaEventId(eventId).map(Program::getId);
		}
		finally {
			reading.unlock();
		}
	}

	/** Records on the connection when the calendar was last read, or why it could not be. */
	private Read finished(Read read, Instant now, @Nullable String error) {
		transactions.executeWithoutResult(status -> connections.current().ifPresent(held -> held.read(now, error)));
		return read;
	}

	private Change take(LumaEvent event) throws IOException {
		Optional<Program> held = programs.findByLumaEventId(event.id());
		URI image = event.cover();
		boolean newImage = image != null
				&& !image.toString().equals(held.map(Program::getLumaCoverUrl).orElse(null));
		LumaHttp.Answer cover = newImage ? image(image) : null;
		Change change = transactions.execute(status -> write(event, held.map(Program::getId).orElse(null),
				cover == null || image == null ? null : new Cover(image, cover)));
		return Objects.requireNonNull(change);
	}

	/** An image of Luma's and what was downloaded of it. */
	private record Cover(URI image, LumaHttp.Answer answer) {
	}

	private Change write(LumaEvent event, @Nullable UUID heldId, @Nullable Cover cover) {
		Program program = heldId == null ? null : programs.findForUpdate(heldId).orElse(null);
		boolean created = program == null;
		if (program == null) {
			program = new Program(slug(event), cut(event.name(), MAX_NAME), ProgramType.EVENT);
			program.readFromLuma(event.id());
		}
		Fields before = Fields.of(program);
		String description = event.description();
		String name = cut(event.name(), MAX_NAME);
		program.describe(name, program.getType(), program.getPartnerName(), summary(description),
				description == null ? null : cut(description, MAX_ABOUT));
		Instant ends = event.endsAt() == null ? event.startsAt() : event.endsAt();
		program.runBetween(LocalDate.ofInstant(event.startsAt(), event.zone()), LocalDate.ofInstant(ends, event.zone()));
		// An event people register for here has its page here; any other keeps Luma's.
		LumaForm form = event.form() != null && properties.registersHere(event.id(), event.name()) ? event.form() : null;
		program.registerAs(form == null ? null : form.json());
		program.showAs(form == null ? PageKind.EXTERNAL : PageKind.STANDARD, event.page().toString());
		program.schedule(program.getMilestones(),
				List.of(new ProgramEvent(cut(event.name(), MAX_EVENT_TITLE), event.startsAt(), event.endsAt(),
						event.online(), event.city(), event.country(), event.page().toString())));
		UUID replacedCover = null;
		if (cover != null) {
			StoredFile kept = storage.keep(FilePurpose.PROGRAM_IMAGE, event.id() + extension(cover.answer().mediaType()),
					Objects.requireNonNull(cover.answer().mediaType()), cover.answer().body());
			replacedCover = program.getCoverFileId();
			program.coverFromLuma(kept.id(), cover.image().toString());
		}
		if (created) {
			programs.saveAndFlush(program);
			record(AuditAction.PROGRAM_CREATE, program);
			// One kept from the public on Luma, or that lacks what publishing asks for, waits for an operator.
			if (event.visibility() == LumaEvent.Visibility.PUBLIC && PublishIssue.of(program).isEmpty()
					&& program.publish(Instant.now())) {
				record(AuditAction.PROGRAM_PUBLISH, program);
			}
			events.publishEvent(new ProgramChanged(program.getId()));
			return Change.CREATED;
		}
		if (before.equals(Fields.of(program))) {
			return Change.UNCHANGED;
		}
		programs.flush();
		record(AuditAction.PROGRAM_UPDATE, program);
		events.publishEvent(new ProgramChanged(program.getId()));
		if (replacedCover != null) {
			events.publishEvent(new ReplacedCovers.CoverReplaced(program.getId(), replacedCover));
		}
		return Change.UPDATED;
	}

	/** What the job writes of a program, to tell whether a read changed it. */
	private record Fields(String name, @Nullable String summary, @Nullable String about, @Nullable LocalDate startsOn,
			@Nullable LocalDate endsOn, PageKind pageKind, @Nullable String externalUrl, List<ProgramEvent> events,
			@Nullable UUID coverFileId, Optional<LumaForm> form) {

		/** The form is compared as read: the database gives back its JSON in an order of its own. */
		static Fields of(Program program) {
			return new Fields(program.getName(), program.getSummary(), program.getAbout(), program.getStartsOn(),
					program.getEndsOn(), program.getPageKind(), program.getExternalUrl(), program.getEvents(),
					program.getCoverFileId(), LumaForm.parse(program.getLumaForm()));
		}
	}

	/** Unpublishes the published programs whose event is still to come but no longer on the calendar. */
	private int unpublishRemoved(Set<String> onCalendar, Instant now) {
		List<UUID> removed = Objects.requireNonNull(transactions.execute(status -> programs.findByLumaEventIdNotNull()
			.stream()
			.filter(program -> program.isPublished() && !onCalendar.contains(program.getLumaEventId())
					&& comingUp(program, now))
			.map(Program::getId)
			.toList()));
		int unpublished = 0;
		for (UUID id : removed) {
			Boolean done = transactions.execute(status -> programs.findForUpdate(id).map(held -> {
				if (!held.unpublish()) {
					return false;
				}
				record(AuditAction.PROGRAM_UNPUBLISH, held);
				events.publishEvent(new ProgramChanged(held.getId()));
				return true;
			}).orElse(false));
			if (Boolean.TRUE.equals(done)) {
				unpublished++;
			}
		}
		return unpublished;
	}

	private static boolean comingUp(Program program, Instant now) {
		return program.getEvents()
			.stream()
			.anyMatch(event -> (event.endsAt() == null ? event.startsAt() : event.endsAt()).isAfter(now));
	}

	/** The image as WebP, PNG or JPEG, which Luma's CDN answers as asked and storage keeps. */
	private LumaHttp.Answer image(URI address) throws IOException {
		LumaHttp.Answer answer = http.get(address, "image/webp,image/png,image/jpeg", MAX_IMAGE_BYTES);
		if (!answer.ok() || answer.body().length > MAX_IMAGE_BYTES || answer.mediaType() == null
				|| !FilePurpose.PROGRAM_IMAGE.mediaTypes().contains(answer.mediaType())) {
			throw new IOException("Luma's image is not one storage keeps");
		}
		return answer;
	}

	private static String extension(@Nullable String mediaType) {
		return switch (mediaType == null ? "" : mediaType) {
			case "image/png" -> ".png";
			case "image/jpeg" -> ".jpg";
			default -> ".webp";
		};
	}

	/**
	 * The address of the event's Luma page ({@code luma.com/gaf-tinyfish-vn} gives {@code gaf-tinyfish-vn}), with
	 * {@code -2}, {@code -3}… when another program has it.
	 */
	private String slug(LumaEvent event) {
		String path = Objects.requireNonNullElse(event.page().getPath(), "");
		String base = slugOf(path.substring(path.lastIndexOf('/') + 1));
		if (base.length() < 3) {
			base = slugOf(event.id());
		}
		return freeSlug(base, programs);
	}

	/** Words as an address: lowercase letters and digits joined by single hyphens. */
	static String slugOf(String words) {
		return Normalizer.normalize(words, Normalizer.Form.NFD)
			.replaceAll("\\p{M}+", "")
			.replace('đ', 'd')
			.replace('Đ', 'D')
			.toLowerCase(Locale.ROOT)
			.replaceAll("[^a-z0-9]+", "-")
			.replaceAll("^-+|-+$", "");
	}

	/** The address, or the first one free after it with a number. */
	static String freeSlug(String address, ProgramRepository programs) {
		String base = trimSlug(address, MAX_SLUG);
		String slug = base;
		for (int n = 2; programs.existsBySlug(slug); n++) {
			String suffix = "-" + n;
			slug = trimSlug(base, MAX_SLUG - suffix.length()) + suffix;
		}
		return slug;
	}

	private static String trimSlug(String slug, int max) {
		return slug.length() <= max ? slug : slug.substring(0, max).replaceAll("-+$", "");
	}

	/** The description's first paragraph, cut to what a summary holds. */
	private static @Nullable String summary(@Nullable String description) {
		if (description == null) {
			return null;
		}
		return description.lines().map(String::strip).filter(line -> !line.isEmpty()).findFirst()
			.map(line -> cut(line, MAX_SUMMARY))
			.orElse(null);
	}

	/** The text, cut at a word to at most {@code max} characters with an ellipsis when it is longer. */
	private static String cut(String text, int max) {
		if (text.length() <= max) {
			return text;
		}
		String head = text.substring(0, max - 1);
		int space = head.lastIndexOf(' ');
		return (space > max / 2 ? head.substring(0, space) : head).strip() + "…";
	}

	private void record(AuditAction action, Program program) {
		// No person acted: the server read the calendar an operator connected.
		audit.record(new AuditRecord(action, null,
				new AuditRecord.Resource(PROGRAM, program.getId().toString(), program.getName()), Map.of()));
	}

}
