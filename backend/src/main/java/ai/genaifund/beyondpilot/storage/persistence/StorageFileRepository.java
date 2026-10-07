package ai.genaifund.beyondpilot.storage.persistence;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

public interface StorageFileRepository extends JpaRepository<StorageFile, UUID> {

	/**
	 * Spends the token of a pending upload. Two requests with the same token may race; the row decides and only one
	 * of them sees a row changed. It commits on its own: the bytes are written after it, outside any transaction.
	 * @return 1 when this call spent the token
	 */
	@Transactional
	@Modifying
	@Query(value = """
			update storage_file set upload_token_hash = null
			where id = :id and status = 'pending' and upload_token_hash = :tokenHash
			""", nativeQuery = true)
	int spendUploadToken(UUID id, String tokenHash);

	/** The uploads never confirmed whose time to send their bytes ended before the given moment. */
	@Query("select f from StorageFile f where f.status = ai.genaifund.beyondpilot.storage.persistence.FileStatus.PENDING "
			+ "and f.uploadExpiresAt < :before")
	List<StorageFile> findAbandoned(Instant before);
}
