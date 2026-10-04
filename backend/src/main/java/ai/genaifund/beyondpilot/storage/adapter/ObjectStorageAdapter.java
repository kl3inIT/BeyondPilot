package ai.genaifund.beyondpilot.storage.adapter;

import java.io.InputStream;
import java.net.URI;
import java.time.Duration;
import java.util.Optional;
import java.util.OptionalLong;

import org.jspecify.annotations.Nullable;

/** Keeps and returns the bytes of files in one object store. An object is named by its key and never changes. */
public interface ObjectStorageAdapter {

	ObjectStorageProvider provider();

	ObjectStorageProviderCapabilities capabilities();

	/** The address the browser sends one upload to, valid for the lifetime of the specification. */
	UploadTarget authorizeUpload(UploadSpecification specification);

	/** Writes an object from this application; the stream holds exactly {@code sizeBytes} bytes. */
	void write(String objectKey, InputStream content, long sizeBytes, String mediaType);

	/** The length of the object, or empty when nothing is stored under the key. */
	OptionalLong size(String objectKey);

	/** The first bytes of the object, fewer when it is shorter. */
	byte[] firstBytes(String objectKey, int length);

	/**
	 * An address that reads the object straight from the store for a short time, or empty when the store has none
	 * and the bytes are read through {@link #open}.
	 * @param downloadName the name to save the file under, or null to show it in the browser
	 */
	Optional<URI> readAddress(String objectKey, String mediaType, @Nullable String downloadName, Duration lifetime);

	InputStream open(String objectKey);

	/** Removes the object; removing one that does not exist is not a failure. */
	void delete(String objectKey);
}
