package ai.genaifund.beyondpilot.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

import javax.imageio.ImageIO;

import ai.genaifund.beyondpilot.TestPdf;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.junit.jupiter.api.Test;

/** A PDF read page by page, with no model: the text the file holds, and the place of a page that holds none. */
class DocumentPagesTest {

	@Test
	void eachPageGivesItsOwnTextAndAPageWithoutTextKeepsItsPlace() throws IOException {
		byte[] pdf = TestPdf.of("Answers inbound customer calls.", "", "Demand forecasting for retail stores.");

		assertThat(PdfPages.text(() -> new ByteArrayInputStream(pdf), 80)).containsExactly(
				"Answers inbound customer calls.", "", "Demand forecasting for retail stores.");
	}

	@Test
	void aLongFileIsReadOnlyToTheNumberOfPagesAsked() throws IOException {
		byte[] pdf = TestPdf.of("One", "Two", "Three");

		assertThat(PdfPages.text(() -> new ByteArrayInputStream(pdf), 2)).containsExactly("One", "Two");
	}

	@Test
	void aPageIsDrawnAsAPictureAndAPageTheFileLacksIsLeftOut() throws IOException {
		byte[] pdf = TestPdf.of("One", "");

		var pictures = PdfPages.pictures(() -> new ByteArrayInputStream(pdf), java.util.List.of(2, 7));

		assertThat(pictures).containsOnlyKeys(2);
		// A PNG starts with these bytes.
		assertThat(pictures.get(2)).startsWith((byte) 0x89, (byte) 'P', (byte) 'N', (byte) 'G');
	}

	@Test
	void aPageIsDrawnAsAJpegUnderALimitAndAsNothingWhenItCannotFit() throws IOException {
		byte[] pdf = TestPdf.of("One", "");

		var fits = PdfPages.jpegs(() -> new ByteArrayInputStream(pdf), java.util.List.of(1, 7), 1_400_000);
		var tooLarge = PdfPages.jpegs(() -> new ByteArrayInputStream(pdf), java.util.List.of(1), 100);

		assertThat(fits).containsOnlyKeys(1);
		// A JPEG starts with these bytes.
		assertThat(fits.get(1)).startsWith((byte) 0xFF, (byte) 0xD8).hasSizeLessThanOrEqualTo(1_400_000);
		// Drawn, and over the limit at the lowest quality: the caller is told so by an empty picture.
		assertThat(tooLarge.get(1)).isEmpty();
	}

	@Test
	void aPageLaidOutAsAPosterIsDrawnNoLargerThanTheBoundAndAnOrdinaryPageKeepsItsSize() throws IOException {
		byte[] pdf;
		try (PDDocument document = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
			// The size of the deck whose pages a service refused on staging, and a US Letter page.
			document.addPage(new PDPage(new PDRectangle(3840, 5430)));
			document.addPage(new PDPage(PDRectangle.LETTER));
			document.save(out);
			pdf = out.toByteArray();
		}

		var pictures = PdfPages.pictures(() -> new ByteArrayInputStream(pdf), java.util.List.of(1, 2));
		BufferedImage poster = ImageIO.read(new ByteArrayInputStream(pictures.get(1)));
		BufferedImage letter = ImageIO.read(new ByteArrayInputStream(pictures.get(2)));

		assertThat(Math.max(poster.getWidth(), poster.getHeight())).isBetween(2190, 2200);
		// 8.5 by 11 inches at 110 DPI.
		assertThat(letter.getWidth()).isBetween(934, 936);
		assertThat(letter.getHeight()).isBetween(1209, 1211);
	}

	@Test
	void aPagesTextKeepsItsLinesAndLosesTheCharactersADatabaseRefuses() {
		// A font without a mapping gives the null character for each glyph.
		assertThat(PdfPages.clean("  Claims\u0000 desk\r\n\u0007reads\tforms\n ")).isEqualTo("Claims desk\nreads\tforms");
	}

	@Test
	void bytesThatAreNotAPdfAreRefused() {
		byte[] picture = { (byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A };

		assertThatThrownBy(() -> PdfPages.text(() -> new ByteArrayInputStream(picture), 80)).isInstanceOf(IOException.class);
	}

}
