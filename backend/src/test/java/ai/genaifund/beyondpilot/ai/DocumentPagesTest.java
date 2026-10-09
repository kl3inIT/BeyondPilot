package ai.genaifund.beyondpilot.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.ByteArrayInputStream;
import java.io.IOException;

import ai.genaifund.beyondpilot.TestPdf;
import org.junit.jupiter.api.Test;

/** A PDF read page by page, with no model: the text the file holds, and the place of a page that holds none. */
class DocumentPagesTest {

	private final DocumentPages pages = new DocumentPages();

	@Test
	void eachPageGivesItsOwnTextAndAPageWithoutTextKeepsItsPlace() throws IOException {
		byte[] pdf = TestPdf.of("Answers inbound customer calls.", "", "Demand forecasting for retail stores.");

		assertThat(pages.text(() -> new ByteArrayInputStream(pdf), 80)).containsExactly(
				"Answers inbound customer calls.", "", "Demand forecasting for retail stores.");
	}

	@Test
	void aLongFileIsReadOnlyToTheNumberOfPagesAsked() throws IOException {
		byte[] pdf = TestPdf.of("One", "Two", "Three");

		assertThat(pages.text(() -> new ByteArrayInputStream(pdf), 2)).containsExactly("One", "Two");
	}

	@Test
	void bytesThatAreNotAPdfAreRefused() {
		byte[] picture = { (byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A };

		assertThatThrownBy(() -> pages.text(() -> new ByteArrayInputStream(picture), 80)).isInstanceOf(IOException.class);
	}

}
