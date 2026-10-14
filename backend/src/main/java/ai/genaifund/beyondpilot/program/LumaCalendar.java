package ai.genaifund.beyondpilot.program;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.program.luma.LumaEventPage;
import ai.genaifund.beyondpilot.program.luma.LumaFeed;
import ai.genaifund.beyondpilot.program.luma.LumaHttp;
import ai.genaifund.beyondpilot.program.luma.LumaProperties;
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
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Brings the events of the GenAI Fund calendar on Luma onto the site (BEY-190). Each event still to come is a published
 * program of type event whose page is its Luma page. Luma owns what it supplies, so a change there overwrites an
 * operator's edit at the next read, and a read that changes nothing writes nothing. The job never changes the status of
 * a program it already holds, except to unpublish one whose future event left the calendar. It runs only where the
 * feed is configured.
 */
@Component
@EnableScheduling
@EnableConfigurationProperties(LumaProperties.class)
@ConditionalOnProperty("beyondpilot.program.luma.feed")
class LumaCalendar {

	private static final Logger LOG = LoggerFactory.getLogger(LumaCalendar.class);

	private static final String PROGRAM = "program";

	/** The most of a feed or an event page read. */
	private static final int MAX_TEXT_BYTES = 2 * 1024 * 1024;

	/** As many as storage keeps of a program's image by default; storage checks its own setting again. */
	private static final int MAX_IMAGE_BYTES = 5 * 1024 * 1024;

	private static final int MAX_NAME = 120;

	private static final int MAX_SUMMARY = 300;

	private static final int MAX_ABOUT = 20_000;

	private static final int MAX_EVENT_TITLE = 160;

	private static final int MAX_SLUG = 60;

	private final LumaProperties properties;

	private final LumaHttp http;

	private final ProgramRepository programs;

	private final StorageService storage;

	private final AuditTrail audit;

	private final ApplicationEventPublisher events;

	private final TransactionTemplate transactions;

	LumaCalendar(LumaProperties properties, ProgramRepository programs, StorageService storage, AuditTrail audit,
			ApplicationEventPublisher events, TransactionTemplate transactions) {
		this.properties = properties;
		this.http = new LumaHttp(properties.hosts(), properties.timeout());
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

	/**
	 * What one read changed.
	 * @param calendarRead false when the feed could not be read, so nothing was changed
	 */
	record Read(int created, int updated, int unpublished, int failed, boolean calendarRead) {
	}

	private enum Change {
		CREATED, UPDATED, UNCHANGED
	}

	/**
	 * Reads the calendar and brings each event still to come onto the site, each in a transaction of its own, so one
	 * that fails leaves the others done and is tried again at the next read. A feed that cannot be read changes
	 * nothing. One read runs at a time: an operator's read waits for the hourly one, so the two never write the same
	 * event together.
	 */
	synchronized Read read(Instant now) {
		List<LumaFeed.Event> feed;
		try {
			feed = LumaFeed.read(text(properties.feed(), "text/calendar"));
		}
		catch (IOException failed) {
			LOG.atWarn()
				.addKeyValue("event", "program.luma.feed_failed")
				.addKeyValue("error_type", failed.getClass().getName())
				.log("The Luma calendar could not be read");
			return new Read(0, 0, 0, 0, false);
		}
		int created = 0;
		int updated = 0;
		int failed = 0;
		for (LumaFeed.Event event : feed) {
			if (event.over(now)) {
				continue;
			}
			try {
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
					.addKeyValue("luma_event_id", event.id())
					.addKeyValue("error_type", failure.getClass().getName())
					.log("A Luma event could not be brought onto the site");
			}
		}
		int unpublished = unpublishRemoved(feed.stream().map(LumaFeed.Event::id).collect(Collectors.toSet()), now);
		Read read = new Read(created, updated, unpublished, failed, true);
		if (created + updated + unpublished + failed > 0) {
			LOG.atInfo()
				.addKeyValue("event", "program.luma.read")
				.addKeyValue("created", created)
				.addKeyValue("updated", updated)
				.addKeyValue("unpublished", unpublished)
				.addKeyValue("failed", failed)
				.log("The Luma calendar was read");
		}
		return read;
	}

	private Change take(LumaFeed.Event event) throws IOException {
		LumaEventPage.Event page = LumaEventPage.read(text(event.page(), "text/html"))
			.orElseThrow(() -> new IOException("The page describes no event"));
		Optional<Program> held = programs.findByLumaEventId(event.id());
		URI image = page.image();
		boolean newImage = image != null
				&& !image.toString().equals(held.map(Program::getLumaCoverUrl).orElse(null));
		LumaHttp.Answer cover = newImage ? image(image) : null;
		Change change = transactions.execute(status -> write(event, page, held.map(Program::getId).orElse(null),
				cover == null || image == null ? null : new Cover(image, cover)));
		return Objects.requireNonNull(change);
	}

	/** An image of Luma's and what was downloaded of it. */
	private record Cover(URI image, LumaHttp.Answer answer) {
	}

	private Change write(LumaFeed.Event event, LumaEventPage.Event page, @Nullable UUID heldId, @Nullable Cover cover) {
		Program program = heldId == null ? null : programs.findForUpdate(heldId).orElse(null);
		boolean created = program == null;
		if (program == null) {
			program = new Program(slug(event), cut(page.name(), MAX_NAME), ProgramType.EVENT);
			program.readFromLuma(event.id());
		}
		Fields before = Fields.of(program);
		String description = page.description();
		OffsetDateTime startsAt = page.startsAt();
		OffsetDateTime said = page.endsAt();
		OffsetDateTime endsAt = said == null || said.isBefore(startsAt) ? null : said;
		String name = cut(page.name(), MAX_NAME);
		program.describe(name, program.getType(), program.getPartnerName(), summary(description),
				description == null ? null : cut(description, MAX_ABOUT));
		program.runBetween(startsAt.toLocalDate(), (endsAt == null ? startsAt : endsAt).toLocalDate());
		program.showAs(PageKind.EXTERNAL, event.page().toString());
		program.schedule(program.getMilestones(),
				List.of(new ProgramEvent(cut(page.name(), MAX_EVENT_TITLE), startsAt.toInstant(),
						endsAt == null ? null : endsAt.toInstant(), page.online(), page.city(), page.country(),
						event.page().toString())));
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
			// One that lacks what publishing asks for, a cover or a summary, waits as a draft for an operator.
			if (PublishIssue.of(program).isEmpty() && program.publish(Instant.now())) {
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
			@Nullable UUID coverFileId) {

		static Fields of(Program program) {
			return new Fields(program.getName(), program.getSummary(), program.getAbout(), program.getStartsOn(),
					program.getEndsOn(), program.getPageKind(), program.getExternalUrl(), program.getEvents(),
					program.getCoverFileId());
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

	private String text(URI address, String accept) throws IOException {
		LumaHttp.Answer answer = http.get(address, accept, MAX_TEXT_BYTES);
		if (!answer.ok() || answer.body().length > MAX_TEXT_BYTES) {
			throw new IOException("Luma answered " + answer.status());
		}
		return new String(answer.body(), StandardCharsets.UTF_8);
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
	private String slug(LumaFeed.Event event) {
		String path = Objects.requireNonNullElse(event.page().getPath(), "");
		String base = path.substring(path.lastIndexOf('/') + 1)
			.toLowerCase(Locale.ROOT)
			.replaceAll("[^a-z0-9]+", "-")
			.replaceAll("^-+|-+$", "");
		if (base.length() < 3) {
			base = event.id().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-");
		}
		base = trimSlug(base, MAX_SLUG);
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
		// No person acted: the server read the calendar it is configured with.
		audit.record(new AuditRecord(action, null,
				new AuditRecord.Resource(PROGRAM, program.getId().toString(), program.getName()), Map.of()));
	}

}
