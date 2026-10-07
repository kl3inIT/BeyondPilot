package ai.genaifund.beyondpilot.usecase.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UseCaseRepository extends JpaRepository<UseCase, UUID> {

	/** One use case, locked for the change the caller is about to make. */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select u from UseCase u where u.id = :id")
	Optional<UseCase> findForUpdate(@Param("id") UUID id);

	/** The use cases of one organization, the most recently touched first. */
	List<UseCase> findByOrganizationIdOrderByUpdatedAtDescIdAsc(UUID organizationId);

	List<UseCase> findByStatus(String status);

	/** Whether a file is already attached to a use case. */
	@Query("select count(u) > 0 from UseCase u join u.attachmentFileIds f where f = :fileId")
	boolean attachmentExists(@Param("fileId") UUID fileId);
}
