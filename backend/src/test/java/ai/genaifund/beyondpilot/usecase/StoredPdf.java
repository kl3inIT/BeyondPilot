package ai.genaifund.beyondpilot.usecase;

import static java.nio.charset.StandardCharsets.UTF_8;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import ai.genaifund.beyondpilot.storage.StorageProperties;

/** The bytes behind a test's file record in the local store, for a test that reads the file itself. */
final class StoredPdf {

	private StoredPdf() {
	}

	/** Writes 2048 bytes of a PDF, as the records of these tests say, where the record {@code test/<id>} points. */
	static void keep(StorageProperties storage, UUID id) {
		byte[] pdf = new byte[2048];
		System.arraycopy("%PDF-1.4".getBytes(UTF_8), 0, pdf, 0, 8);
		try {
			Path target = storage.local().directory().toAbsolutePath().resolve("test/" + id);
			Files.createDirectories(target.getParent());
			Files.write(target, pdf);
		}
		catch (IOException exception) {
			throw new UncheckedIOException(exception);
		}
	}
}
