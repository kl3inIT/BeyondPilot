package ai.genaifund.beyondpilot.shared;

import java.nio.charset.StandardCharsets;

import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

/**
 * A list written as a spreadsheet, ready to download.
 * @param fileName the name the download is saved under, its extension included
 * @param format what the content is
 * @param content the bytes of the file
 * @param rows how many records it holds, for the audit record and the log
 */
public record SpreadsheetFile(String fileName, SpreadsheetFormat format, byte[] content, int rows) {

	/**
	 * The download as a controller answers it: never cached, since it holds what only operators read, and saved under
	 * its name.
	 */
	public ResponseEntity<byte[]> response() {
		return ResponseEntity.ok()
			.contentType(MediaType.parseMediaType(format.contentType()))
			.cacheControl(CacheControl.noStore())
			.header(HttpHeaders.CONTENT_DISPOSITION,
					ContentDisposition.attachment().filename(fileName, StandardCharsets.UTF_8).build().toString())
			.body(content);
	}

}
