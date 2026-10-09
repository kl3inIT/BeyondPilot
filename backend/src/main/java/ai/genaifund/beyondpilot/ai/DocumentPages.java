package ai.genaifund.beyondpilot.ai;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.core.io.InputStreamSource;
import org.springframework.stereotype.Service;

/**
 * Reads a PDF page by page, for the modules that keep what a file says: a solution's deck for search, a use case's
 * attachment for matching. A page gives the text the file itself holds; no model is called for that. A page that is
 * only a picture gives an empty text, which a model can then read from the picture of the page.
 */
@Service
public class DocumentPages {

	/**
	 * The text of each page, in order, up to a number of pages. A page without text is an empty string, so the place
	 * of every page is kept.
	 * @throws IOException when the bytes are not a PDF that can be read
	 */
	public List<String> text(InputStreamSource pdf, int maxPages) throws IOException {
		try (InputStream content = pdf.getInputStream(); PDDocument document = Loader.loadPDF(content.readAllBytes())) {
			PDFTextStripper stripper = new PDFTextStripper();
			stripper.setSortByPosition(true);
			int count = Math.min(document.getNumberOfPages(), maxPages);
			List<String> pages = new ArrayList<>(count);
			for (int page = 1; page <= count; page++) {
				stripper.setStartPage(page);
				stripper.setEndPage(page);
				pages.add(stripper.getText(document).strip());
			}
			return pages;
		}
	}

}
