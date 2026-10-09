package ai.genaifund.beyondpilot.ai;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.InputStreamSource;
import org.springframework.stereotype.Service;
import org.springframework.util.MimeTypeUtils;

/**
 * Reads a PDF page by page, for the modules that keep what a file says: a solution's deck for search, a use case's
 * attachment for matching. A page gives the text the file itself holds; no model is called for that. A page that is
 * only a picture gives an empty text, and the model operators chose for {@link AiTask#DOCUMENT_READING} can copy
 * its text from the picture of the page.
 */
@Service
public class DocumentPages {

	private static final Logger LOG = LoggerFactory.getLogger(DocumentPages.class);

	private static final String COPY = """
			You copy the text of one page from its picture. Copy every word you can read, in reading order, exactly \
			as it is written and in its own language. Do not describe pictures or charts, do not translate, and do not \
			add or explain anything. If the page has no text, answer with nothing.""";

	private final AiModels models;

	DocumentPages(AiModels models) {
		this.models = models;
	}

	/**
	 * The text of each page, in order, up to a number of pages. A page without text is an empty string, so the place
	 * of every page is kept.
	 * @throws IOException when the bytes are not a PDF that can be read
	 */
	public List<String> text(InputStreamSource pdf, int maxPages) throws IOException {
		return PdfPages.text(pdf, maxPages);
	}

	/** Whether a model is chosen to read pages from their picture, and its provider can be used. */
	public boolean readsPictures() {
		return models.available(AiTask.DOCUMENT_READING);
	}

	/**
	 * What the model reads on these pages, by page number: each is sent as a picture, one call a page, and each call
	 * is recorded. A page it finds no text on is an empty string. Reading stops at the first call that fails, such as
	 * at the provider's limit, and answers what was read until then; the rest is asked for again later.
	 * @param subject what the file belongs to, for the usage record
	 * @throws IOException when the bytes are not a PDF that can be read
	 * @throws AiException when no model is chosen for the task
	 */
	public Map<Integer, String> readPictures(InputStreamSource pdf, List<Integer> pages, AiSubject subject)
			throws IOException {
		Map<Integer, byte[]> pictures = PdfPages.pictures(pdf, pages);
		Map<Integer, String> read = new LinkedHashMap<>();
		try (AiChat chat = models.chat(AiTask.DOCUMENT_READING, subject)) {
			for (Map.Entry<Integer, byte[]> picture : pictures.entrySet()) {
				try {
					String text = chat.client()
						.prompt()
						.system(COPY)
						.user(user -> user.text("Copy the text of this page.")
							.media(MimeTypeUtils.IMAGE_PNG, new ByteArrayResource(picture.getValue())))
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

}
