package ai.genaifund.beyondpilot.storage;

import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Optional;
import java.util.OptionalLong;
import java.util.Collection;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.storage.adapter.ObjectStorageAdapter;
import ai.genaifund.beyondpilot.storage.adapter.ObjectStorageAdapterRegistry;
import ai.genaifund.beyondpilot.storage.adapter.UploadSpecification;
import ai.genaifund.beyondpilot.storage.adapter.UploadTarget;
import ai.genaifund.beyondpilot.storage.dto.ReserveUploadRequest;
import ai.genaifund.beyondpilot.storage.dto.StoredFileResponse;
import ai.genaifund.beyondpilot.storage.dto.UploadTicketResponse;
import ai.genaifund.beyondpilot.storage.persistence.StorageFile;
import ai.genaifund.beyondpilot.storage.persistence.StorageFileRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Uploads and reads of files. An upload is three steps: reserve it, send the bytes to the address of the ticket, and
 * confirm it; only a confirmed file can be read or attached to a record. The module that owns the record decides who
 * may attach a file and who may read a private one.
 */
@Service
@EnableConfigurationProperties(StorageProperties.class)
public class StorageService {

	private static final Logger LOG = LoggerFactory.getLogger(StorageService.class);

	private static final DateTimeFormatter KEY_MONTH = DateTimeFormatter.ofPattern("yyyy/MM").withZone(ZoneOffset.UTC);

	/** Enough to recognise every accepted media type by how its content starts. */
	private static final int SIGNATURE_LENGTH = 12;

	private static final int MAX_FILE_NAME_LENGTH = 255;

	private final StorageFileRepository files;
	private final ObjectStorageAdapterRegistry adapters;
	private final IdentityService identity;
	private final StorageProperties properties;
	private final SecureRandom random = new SecureRandom();

	StorageService(StorageFileRepository files, ObjectStorageAdapterRegistry adapters, IdentityService identity,
			StorageProperties properties) {
		this.files = files;
		this.adapters = adapters;
		this.identity = identity;
		this.properties = properties;
	}

	/**
	 * Reserves an upload and says where to send its bytes.
	 * @throws StorageException when the purpose refuses the caller, the media type or the size
	 */
	@Transactional
	public UploadTicketResponse reserve(Actor actor, ReserveUploadRequest request) {
		FilePurpose purpose = request.purpose();
		identity.requireActive(actor);
		if (purpose.operatorOnly() && !identity.isOperator(actor)) {
			throw new StorageException(StorageErrorCode.UPLOAD_NOT_PERMITTED,
					"Upload for " + purpose.value() + " by account " + actor.accountId() + ", not an operator");
		}
		String mediaType = request.mediaType().strip().toLowerCase(Locale.ROOT);
		if (!purpose.mediaTypes().contains(mediaType)) {
			throw new StorageException(StorageErrorCode.MEDIA_TYPE_NOT_ALLOWED,
					"Media type not accepted for " + purpose.value());
		}
		if (request.sizeBytes() > properties.maxSizeBytes(purpose)) {
			throw new StorageException(StorageErrorCode.FILE_TOO_LARGE,
					request.sizeBytes() + " bytes announced for " + purpose.value());
		}

		UUID id = UUID.randomUUID();
		Instant now = Instant.now();
		Instant expiresAt = now.plus(properties.ticketLifetime());
		ObjectStorageAdapter adapter = adapters.adapter(properties.provider());
		String token = newToken();
		String objectKey = purpose.value() + "/" + KEY_MONTH.format(now) + "/" + id;
		files.save(new StorageFile(id, adapter.provider(), objectKey, purpose, displayName(request.fileName()),
				mediaType, request.sizeBytes(), actor.accountId(),
				adapter.capabilities().receivesThroughApplication() ? hash(token) : null, expiresAt));
		UploadTarget target = adapter.authorizeUpload(new UploadSpecification(id, objectKey, mediaType,
				request.sizeBytes(), properties.ticketLifetime(), token));
		return new UploadTicketResponse(id, target.method(), target.url(), target.headers(), expiresAt);
	}

	/**
	 * Receives the bytes of an upload whose object store takes them through this application. The token works once.
	 * @throws StorageException when the upload is not the caller's, its ticket is spent or expired, or the body is
	 * not the announced length
	 */
	public void receive(Actor actor, UUID id, String token, long contentLength, InputStream content) {
		StorageFile file = pendingOf(actor, id);
		ObjectStorageAdapter adapter = adapters.adapter(file.getProvider());
		if (!adapter.capabilities().receivesThroughApplication()) {
			throw notFound(id);
		}
		if (file.uploadExpired(Instant.now())) {
			throw new StorageException(StorageErrorCode.TICKET_EXPIRED, "Ticket of file " + id + " expired");
		}
		if (contentLength != file.getSizeBytes()) {
			throw new StorageException(StorageErrorCode.CONTENT_MISMATCH,
					"File " + id + " announced " + file.getSizeBytes() + " bytes, the request " + contentLength);
		}
		if (files.spendUploadToken(id, hash(token)) != 1) {
			throw new StorageException(StorageErrorCode.TICKET_REFUSED, "Token of file " + id + " refused");
		}
		adapter.write(file.getObjectKey(), new AtMost(content, file.getSizeBytes()), file.getSizeBytes(),
				file.getMediaType());
	}

	/**
	 * Checks that the bytes are in the object store and are what was announced, and makes the file usable. Confirming
	 * a file that is already stored changes nothing.
	 * @throws StorageException when nothing was uploaded, or the upload is not the announced file
	 */
	@Transactional
	public StoredFileResponse confirm(Actor actor, UUID id) {
		StorageFile file = files.findById(id)
			.filter(found -> found.getUploadedByAccountId().equals(actor.accountId()))
			.orElseThrow(() -> notFound(id));
		if (!file.isStored()) {
			ObjectStorageAdapter adapter = adapters.adapter(file.getProvider());
			OptionalLong size = adapter.size(file.getObjectKey());
			if (size.isEmpty()) {
				throw new StorageException(StorageErrorCode.UPLOAD_MISSING, "Nothing uploaded for file " + id);
			}
			if (size.getAsLong() != file.getSizeBytes()
					|| !startsAs(file.getMediaType(), adapter.firstBytes(file.getObjectKey(), SIGNATURE_LENGTH))) {
				adapter.delete(file.getObjectKey());
				throw new StorageException(StorageErrorCode.CONTENT_MISMATCH,
						"The upload of file " + id + " is not the announced " + file.getMediaType() + " of "
								+ file.getSizeBytes() + " bytes");
			}
			file.markStored(Instant.now());
			LOG.atInfo()
				.addKeyValue("event", "storage.file.stored")
				.addKeyValue("file_id", id)
				.addKeyValue("purpose", file.getPurpose().value())
				.addKeyValue("provider", file.getProvider())
				.addKeyValue("size_bytes", file.getSizeBytes())
				.log("File stored");
		}
		return new StoredFileResponse(file.getId(), file.getFileName(), file.getMediaType(), file.getSizeBytes());
	}

	/**
	 * A file anyone may read.
	 * @throws StorageException when no stored public file has this identifier; a private or a pending file answers
	 * the same, so the address does not reveal that one exists
	 */
	@Transactional(readOnly = true)
	public FileDownload publicFile(UUID id) {
		StorageFile file = files.findById(id)
			.filter(found -> found.isStored() && found.isPublicRead())
			.orElseThrow(() -> notFound(id));
		return download(file, false);
	}

	/**
	 * A stored file, for the module that owns the record it belongs to and has checked that the reader may have it.
	 * The browser saves it under its name.
	 * @throws StorageException when no stored file has this identifier
	 */
	@Transactional(readOnly = true)
	public FileDownload download(UUID id) {
		return download(files.findById(id).filter(StorageFile::isStored).orElseThrow(() -> notFound(id)), true);
	}

	/**
	 * The file a caller wants to attach to a record: stored, of the purpose the record expects, and uploaded by the
	 * caller.
	 * @throws StorageException when the file is not that
	 */
	@Transactional(readOnly = true)
	public StoredFile stored(UUID id, FilePurpose purpose, Actor uploader) {
		StorageFile file = files.findById(id)
			.filter(found -> found.isStored() && found.getPurpose() == purpose
					&& found.getUploadedByAccountId().equals(uploader.accountId()))
			.orElseThrow(() -> notFound(id));
		return new StoredFile(file.getId(), file.getPurpose(), file.getFileName(), file.getMediaType(),
				file.getSizeBytes(), file.getUploadedByAccountId());
	}

	/** What is known of the stored files with these identifiers, for a module that reads the records naming them. */
	@Transactional(readOnly = true)
	public Map<UUID, StoredFile> describe(Collection<UUID> ids) {
		return files.findAllById(ids)
			.stream()
			.filter(StorageFile::isStored)
			.collect(Collectors.toMap(StorageFile::getId,
					file -> new StoredFile(file.getId(), file.getPurpose(), file.getFileName(), file.getMediaType(),
							file.getSizeBytes(), file.getUploadedByAccountId())));
	}

	/** Removes a file and its bytes, for the module whose record no longer names it. */
	@Transactional
	public void delete(UUID id) {
		files.findById(id).ifPresent(file -> {
			adapters.adapter(file.getProvider()).delete(file.getObjectKey());
			files.delete(file);
		});
	}

	private FileDownload download(StorageFile file, boolean attachment) {
		ObjectStorageAdapter adapter = adapters.adapter(file.getProvider());
		Optional<URI> address = adapter.readAddress(file.getObjectKey(), file.getMediaType(),
				attachment ? file.getFileName() : null, properties.readAddressLifetime());
		String objectKey = file.getObjectKey();
		return new FileDownload(file.getFileName(), file.getMediaType(), file.getSizeBytes(), attachment,
				address.orElse(null), address.isPresent() ? properties.readAddressLifetime() : null,
				address.isPresent() ? null : () -> adapter.open(objectKey));
	}

	private StorageFile pendingOf(Actor actor, UUID id) {
		return files.findById(id)
			.filter(found -> !found.isStored() && found.getUploadedByAccountId().equals(actor.accountId()))
			.orElseThrow(() -> notFound(id));
	}

	private static StorageException notFound(UUID id) {
		return new StorageException(StorageErrorCode.FILE_NOT_FOUND, "No such file for this caller: " + id);
	}

	/** The name without any directory a browser or a person put before it, and without control characters. */
	private static String displayName(String fileName) {
		String name = fileName.substring(Math.max(fileName.lastIndexOf('/'), fileName.lastIndexOf('\\')) + 1)
			.replaceAll("\\p{Cntrl}", "")
			.strip();
		if (name.isEmpty()) {
			return "file";
		}
		return name.length() > MAX_FILE_NAME_LENGTH ? name.substring(name.length() - MAX_FILE_NAME_LENGTH) : name;
	}

	private static boolean startsAs(String mediaType, byte[] start) {
		return switch (mediaType) {
			case "application/pdf" -> startsWith(start, 0, "%PDF-".getBytes(StandardCharsets.US_ASCII));
			case "image/png" -> startsWith(start, 0, new byte[] { (byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n' });
			case "image/jpeg" -> startsWith(start, 0, new byte[] { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF });
			case "image/webp" -> startsWith(start, 0, "RIFF".getBytes(StandardCharsets.US_ASCII))
					&& startsWith(start, 8, "WEBP".getBytes(StandardCharsets.US_ASCII));
			default -> false;
		};
	}

	private static boolean startsWith(byte[] content, int offset, byte[] signature) {
		return content.length >= offset + signature.length
				&& Arrays.equals(content, offset, offset + signature.length, signature, 0, signature.length);
	}

	private String newToken() {
		byte[] bytes = new byte[32];
		random.nextBytes(bytes);
		return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
	}

	private static String hash(String token) {
		try {
			return HexFormat.of()
				.formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
		}
		catch (NoSuchAlgorithmException exception) {
			throw new IllegalStateException(exception);
		}
	}

	/** Stops reading a request body that runs past the announced length, whatever its headers said. */
	private static final class AtMost extends FilterInputStream {

		private long remaining;

		AtMost(InputStream content, long limit) {
			super(content);
			this.remaining = limit;
		}

		@Override
		public int read() throws IOException {
			int value = super.read();
			if (value >= 0) {
				count(1);
			}
			return value;
		}

		@Override
		public int read(byte[] buffer, int offset, int length) throws IOException {
			int read = super.read(buffer, offset, length);
			if (read > 0) {
				count(read);
			}
			return read;
		}

		private void count(int read) throws IOException {
			remaining -= read;
			if (remaining < 0) {
				throw new IOException("The upload is longer than announced");
			}
		}
	}
}
