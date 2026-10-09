package ai.genaifund.beyondpilot.ai;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.ai.adapter.OcrAdapter;
import ai.genaifund.beyondpilot.ai.adapter.OcrAdapterRegistry;
import ai.genaifund.beyondpilot.ai.adapter.OcrConnection;
import ai.genaifund.beyondpilot.ai.adapter.OcrProviderException;
import ai.genaifund.beyondpilot.ai.persistence.AiTaskModelRepository;
import ai.genaifund.beyondpilot.ai.persistence.AiUsageRepository;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.InputStreamSource;
import org.springframework.stereotype.Service;
import org.springframework.util.MimeTypeUtils;

/**
 * Reads a PDF page by page, for the modules that keep what a file says: a solution's deck for search, a use case's
 * attachment for matching. A page gives the text the file itself holds; nothing is called for that. A page that is
 * only a picture gives an empty text, and the reader operators chose for {@link AiTask#DOCUMENT_READING} can copy its
 * text from the picture of the page: a chat model that reads images, or an OCR service.
 */
@Service
public class DocumentPages {

	private static final Logger LOG = LoggerFactory.getLogger(DocumentPages.class);

	/**
	 * The largest picture of a page sent to a model. A gateway refuses a request that is too large: on 9 October the
	 * 9Router route answered 413 to a page of 4 MB and took one of 2.7 MB, and a refused page was asked for again
	 * every minute. A slide is read as well from a JPEG of this size.
	 */
	private static final int MODEL_PICTURE_BYTES = 1_500_000;

	private static final String COPY = """
			You copy the text of one page from its picture. Copy every word you can read, in reading order, exactly \
			as it is written and in its own language. Do not describe pictures or charts, do not translate, and do not \
			add or explain anything. If the page has no text, answer with nothing.""";

	private final AiModels models;

	private final AiTaskModelRepository tasks;

	private final AiProviders providers;

	private final OcrAdapterRegistry adapters;

	private final AiUsageRepository usage;

	private final AiSettings settings;

	private final Prices prices;

	DocumentPages(AiModels models, AiTaskModelRepository tasks, AiProviders providers, OcrAdapterRegistry adapters,
			AiUsageRepository usage, AiSettings settings, Prices prices) {
		this.prices = prices;
		this.models = models;
		this.tasks = tasks;
		this.providers = providers;
		this.adapters = adapters;
		this.usage = usage;
		this.settings = settings;
	}

	/**
	 * The text of each page, in order, up to a number of pages. A page without text is an empty string, so the place
	 * of every page is kept.
	 * @throws IOException when the bytes are not a PDF that can be read
	 */
	public List<String> text(InputStreamSource pdf, int maxPages) throws IOException {
		return PdfPages.text(pdf, maxPages);
	}

	/** Whether a reader is chosen for pages that are only a picture, and it can be used. */
	public boolean readsPictures() {
		UUID service = ocrProviderId();
		return service == null ? models.available(AiTask.DOCUMENT_READING) : ocr(service) != null;
	}

	/**
	 * What the reader reads on these pages, by page number: each is sent as a picture, one call a page, and each call
	 * is recorded. A page it finds no text on is an empty string, and so is a page an OCR service will not take.
	 * Reading stops at the first call that fails otherwise, such as at the provider's limit, and answers what was read
	 * until then; the rest is asked for again later.
	 * @param subject what the file belongs to, for the usage record
	 * @throws IOException when the bytes are not a PDF that can be read
	 * @throws AiException when no reader is chosen, or the one chosen cannot be used
	 */
	public Map<Integer, String> readPictures(InputStreamSource pdf, List<Integer> pages, AiSubject subject)
			throws IOException {
		UUID service = ocrProviderId();
		if (service == null) {
			return readWithModel(pdf, pages, subject);
		}
		Ocr ocr = ocr(service);
		if (ocr == null) {
			throw new AiException(AiErrorCode.TASK_NOT_CONFIGURED, "The OCR service chosen to read pages cannot be used");
		}
		return readWithOcr(ocr, pdf, pages, subject);
	}

	private Map<Integer, String> readWithModel(InputStreamSource pdf, List<Integer> pages, AiSubject subject)
			throws IOException {
		Map<Integer, byte[]> pictures = PdfPages.jpegs(pdf, pages, MODEL_PICTURE_BYTES);
		Map<Integer, String> read = new LinkedHashMap<>();
		try (AiChat chat = models.chat(AiTask.DOCUMENT_READING, subject)) {
			for (Map.Entry<Integer, byte[]> picture : pictures.entrySet()) {
				if (picture.getValue().length == 0) {
					// Still over the limit at the lowest quality: settled as empty, so it is not drawn again.
					read.put(picture.getKey(), "");
					continue;
				}
				try {
					String text = chat.client()
						.prompt()
						.system(COPY)
						.user(user -> user.text("Copy the text of this page.")
							.media(MimeTypeUtils.IMAGE_JPEG, new ByteArrayResource(picture.getValue())))
						.call()
						.content();
					read.put(picture.getKey(), text == null ? "" : text.strip());
				}
				catch (RuntimeException failure) {
					// What the provider said can repeat the request, so only the kind of failure is kept.
					LOG.atInfo()
						.addKeyValue("event", "ai.document.page_not_read")
						.addKeyValue("error_type", failure.getClass().getName())
						.log("A page was not read from its picture; it is asked for again later");
					break;
				}
			}
		}
		return read;
	}

	/** The text is kept as the service returns it; for AI Hay that is Markdown. */
	private Map<Integer, String> readWithOcr(Ocr ocr, InputStreamSource pdf, List<Integer> pages, AiSubject subject)
			throws IOException {
		Map<Integer, byte[]> pictures = PdfPages.jpegs(pdf, pages, ocr.adapter().maxPictureBytes());
		Map<Integer, String> read = new LinkedHashMap<>();
		for (Map.Entry<Integer, byte[]> picture : pictures.entrySet()) {
			if (picture.getValue().length == 0) {
				// Still over the service's limit at the lowest quality: settled as empty, so it is not drawn again.
				read.put(picture.getKey(), "");
				continue;
			}
			Instant started = Instant.now();
			long clock = System.nanoTime();
			try {
				String text = ocr.adapter().read(ocr.connectionOf(), picture.getValue(), settings.callTimeout());
				record(ocr, subject, started, clock, null);
				read.put(picture.getKey(), text.strip());
			}
			catch (OcrProviderException failure) {
				record(ocr, subject, started, clock, failure.getClass().getName());
				LOG.atInfo()
					.addKeyValue("event", "ai.document.page_not_read")
					.addKeyValue("error_type", failure.getClass().getName())
					.addKeyValue("error_code", failure.failure().name())
					.log("An OCR service did not read a page from its picture");
				if (failure.failure() != OcrProviderException.Failure.PICTURE_REFUSED) {
					break;
				}
				// The service will not take this picture, and asking again would not change that.
				read.put(picture.getKey(), "");
			}
		}
		return read;
	}

	/** The OCR provider chosen to read pages; null when a model reads them, or nothing does. */
	private @Nullable UUID ocrProviderId() {
		return tasks.findById(AiTask.DOCUMENT_READING.value()).map(row -> row.getOcrProviderId()).orElse(null);
	}

	/** The service to call; null when it is switched off, has no readable key, or speaks an API nothing here does. */
	private @Nullable Ocr ocr(UUID providerId) {
		AiConnection connection = providers.connection(AiProviders.OCR, providerId).orElse(null);
		if (connection == null) {
			return null;
		}
		AiProviderView provider = providers.get(AiProviders.OCR, providerId);
		OcrAdapter adapter = adapters.adapter(connection.adapterType()).orElse(null);
		return !provider.enabled() || adapter == null ? null
				: new Ocr(adapter, connection,
						prices.ofOcr(connection.adapterType(), provider.pricePerThousandCalls()).perThousand());
	}

	/**
	 * One row per page sent, without tokens: a service bills by the call, and the row keeps what 1,000 calls cost
	 * then. A failed write fails nothing.
	 */
	private void record(Ocr ocr, AiSubject subject, Instant started, long clock, @Nullable String errorType) {
		try {
			usage.add(new AiUsageRepository.Call(started, AiTask.DOCUMENT_READING.value(), ocr.connection().providerId(),
					ocr.connection().name(), ocr.adapter().type(), null, null, null, null,
					(System.nanoTime() - clock) / 1_000_000, errorType, subject.type(), subject.id(), null, null, null,
					ocr.pricePerThousandCalls()));
		}
		catch (RuntimeException unwritten) {
			LOG.atWarn()
				.addKeyValue("event", "ai.usage.not_recorded")
				.addKeyValue("error_type", unwritten.getClass().getName())
				.log("A call to an OCR service was not recorded");
		}
	}

	/** An OCR service ready to be called. It holds the key in clear for as long as a file is being read. */
	private record Ocr(OcrAdapter adapter, AiConnection connection, @Nullable BigDecimal pricePerThousandCalls) {

		OcrConnection connectionOf() {
			return new OcrConnection(connection.baseUrl(), connection.apiKey());
		}

	}

}
