package ai.genaifund.beyondpilot.storage.persistence;

import java.time.Instant;
import java.util.UUID;

import ai.genaifund.beyondpilot.storage.FilePurpose;
import ai.genaifund.beyondpilot.storage.adapter.ObjectStorageProvider;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.jspecify.annotations.Nullable;

/** One uploaded file: what is known about it, and where its bytes are. It is pending until its upload is confirmed. */
@Entity
@Table(name = "storage_file")
public class StorageFile {

	@Id
	private UUID id;

	@Column(nullable = false, updatable = false)
	private ObjectStorageProvider provider;

	@Column(nullable = false, updatable = false)
	private String objectKey;

	@Column(nullable = false, updatable = false)
	private FilePurpose purpose;

	@Column(nullable = false, updatable = false)
	private boolean publicRead;

	@Column(nullable = false, updatable = false)
	private String fileName;

	@Column(nullable = false, updatable = false)
	private String mediaType;

	@Column(nullable = false, updatable = false)
	private long sizeBytes;

	@Column(nullable = false)
	private FileStatus status;

	@Column(nullable = false, updatable = false)
	private UUID uploadedByAccountId;

	private @Nullable String uploadTokenHash;

	@Column(nullable = false, updatable = false)
	private Instant uploadExpiresAt;

	private @Nullable Instant storedAt;

	@SuppressWarnings("NullAway.Init")
	protected StorageFile() {
	}

	/** A reserved upload. */
	public StorageFile(UUID id, ObjectStorageProvider provider, String objectKey, FilePurpose purpose, String fileName,
			String mediaType, long sizeBytes, UUID uploadedByAccountId, @Nullable String uploadTokenHash,
			Instant uploadExpiresAt) {
		this.id = id;
		this.provider = provider;
		this.objectKey = objectKey;
		this.purpose = purpose;
		this.publicRead = purpose.publicRead();
		this.fileName = fileName;
		this.mediaType = mediaType;
		this.sizeBytes = sizeBytes;
		this.status = FileStatus.PENDING;
		this.uploadedByAccountId = uploadedByAccountId;
		this.uploadTokenHash = uploadTokenHash;
		this.uploadExpiresAt = uploadExpiresAt;
	}

	public UUID getId() {
		return id;
	}

	public ObjectStorageProvider getProvider() {
		return provider;
	}

	public String getObjectKey() {
		return objectKey;
	}

	public FilePurpose getPurpose() {
		return purpose;
	}

	public boolean isPublicRead() {
		return publicRead;
	}

	public String getFileName() {
		return fileName;
	}

	public String getMediaType() {
		return mediaType;
	}

	public long getSizeBytes() {
		return sizeBytes;
	}

	public UUID getUploadedByAccountId() {
		return uploadedByAccountId;
	}

	public boolean isStored() {
		return status == FileStatus.STORED;
	}

	public boolean uploadExpired(Instant now) {
		return !now.isBefore(uploadExpiresAt);
	}

	public void markStored(Instant at) {
		status = FileStatus.STORED;
		storedAt = at;
		uploadTokenHash = null;
	}
}
