package ai.genaifund.beyondpilot;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;

/** A PDF made for a test: one page per text, and a page with nothing on it for an empty text. */
public final class TestPdf {

	private TestPdf() {
	}

	public static byte[] of(String... pages) {
		try (PDDocument document = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
			for (String text : pages) {
				PDPage page = new PDPage();
				document.addPage(page);
				if (!text.isEmpty()) {
					try (PDPageContentStream content = new PDPageContentStream(document, page)) {
						content.beginText();
						content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
						content.newLineAtOffset(50, 700);
						content.showText(text);
						content.endText();
					}
				}
			}
			document.save(out);
			return out.toByteArray();
		}
		catch (IOException failure) {
			throw new UncheckedIOException(failure);
		}
	}

}
