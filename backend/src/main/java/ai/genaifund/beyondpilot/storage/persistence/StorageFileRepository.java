package ai.genaifund.beyondpilot.storage.persistence;

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
}
