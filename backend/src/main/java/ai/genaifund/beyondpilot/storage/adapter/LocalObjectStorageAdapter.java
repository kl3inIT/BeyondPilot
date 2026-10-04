package ai.genaifund.beyondpilot.storage.adapter;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalLong;

import ai.genaifund.beyondpilot.storage.StorageProperties;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Keeps objects as files under one directory. The browser sends an upload to this application, which writes it here;
 * a deployed environment that uses this store needs the directory on a volume.
 */
@Component
class LocalObjectStorageAdapter implements ObjectStorageAdapter {

	/** The receiving address of {@code web.UploadController}; the ticket names it so the browser needs no rule. */
	private static final String RECEIVE_PATH = "/api/storage/uploads/{id}/content";

	private final Path root;

	LocalObjectStorageAdapter(StorageProperties properties) {
		this.root = properties.local().directory().toAbsolutePath().normalize();
	}

	@Override
	public ObjectStorageProvider provider() {
		return ObjectStorageProvider.LOCAL;
	}

	@Override
	public ObjectStorageProviderCapabilities capabilities() {
		return new ObjectStorageProviderCapabilities(true);
	}

	@Override
	public UploadTarget authorizeUpload(UploadSpecification specification) {
		String url = UriComponentsBuilder.fromPath(RECEIVE_PATH)
			.queryParam("token", specification.token())
			.buildAndExpand(specification.fileId())
			.toUriString();
		// The receiving address changes state, so the request carries the header every such request carries.
		return new UploadTarget("PUT", url,
				Map.of(HttpHeaders.CONTENT_TYPE, specification.mediaType(), "X-BeyondPilot-CSRF", "1"));
	}

	@Override
	public void write(String objectKey, InputStream content, long sizeBytes, String mediaType) {
		Path target = path(objectKey);
		try {
			Files.createDirectories(target.getParent());
			// Written beside the target and moved, so a reader never sees half a file.
			Path partial = Files.createTempFile(target.getParent(), "upload-", ".part");
			try {
				Files.copy(content, partial, StandardCopyOption.REPLACE_EXISTING);
				Files.move(partial, target, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
			}
			finally {
				Files.deleteIfExists(partial);
			}
		}
		catch (IOException exception) {
			throw new UncheckedIOException(exception);
		}
	}

	@Override
	public OptionalLong size(String objectKey) {
		Path path = path(objectKey);
		try {
			return Files.isRegularFile(path) ? OptionalLong.of(Files.size(path)) : OptionalLong.empty();
		}
		catch (IOException exception) {
			throw new UncheckedIOException(exception);
		}
	}

	@Override
	public byte[] firstBytes(String objectKey, int length) {
		try (InputStream content = open(objectKey)) {
			return content.readNBytes(length);
		}
		catch (IOException exception) {
			throw new UncheckedIOException(exception);
		}
	}

	@Override
	public Optional<URI> readAddress(String objectKey, String mediaType, @Nullable String downloadName,
			Duration lifetime) {
		return Optional.empty();
	}

	@Override
	public InputStream open(String objectKey) {
		try {
			return Files.newInputStream(path(objectKey));
		}
		catch (IOException exception) {
			throw new UncheckedIOException(exception);
		}
	}

	@Override
	public void delete(String objectKey) {
		try {
			Files.deleteIfExists(path(objectKey));
		}
		catch (IOException exception) {
			throw new UncheckedIOException(exception);
		}
	}

	private Path path(String objectKey) {
		Path path = root.resolve(objectKey).normalize();
		if (!path.startsWith(root)) {
			throw new IllegalArgumentException("An object key stays inside the storage directory");
		}
		return path;
	}
}
