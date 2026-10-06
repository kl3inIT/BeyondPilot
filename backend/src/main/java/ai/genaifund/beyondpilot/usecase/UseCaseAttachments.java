package ai.genaifund.beyondpilot.usecase;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.storage.FilePurpose;
import ai.genaifund.beyondpilot.storage.StorageException;
import ai.genaifund.beyondpilot.storage.StorageService;
import ai.genaifund.beyondpilot.storage.StoredFile;
import ai.genaifund.beyondpilot.usecase.dto.UseCaseAttachmentResponse;
import ai.genaifund.beyondpilot.usecase.persistence.UseCase;
import ai.genaifund.beyondpilot.usecase.persistence.UseCaseRepository;
import org.springframework.stereotype.Component;

/** The files a use case names: which a caller may attach, and how the attached ones read. */
@Component
class UseCaseAttachments {

	private final StorageService storage;

	private final UseCaseRepository useCases;

	UseCaseAttachments(StorageService storage, UseCaseRepository useCases) {
		this.storage = storage;
		this.useCases = useCases;
	}

	/**
	 * Each file is one the caller uploaded for a use case, listed once, and attached to no other use case.
	 * @param attachedHere the files the use case already names, which may stay
	 * @throws UseCaseException when a file is not usable
	 */
	void requireUsable(Actor actor, List<UUID> fileIds, List<UUID> attachedHere) {
		if (fileIds.stream().distinct().count() != fileIds.size()) {
			throw new UseCaseException(UseCaseErrorCode.ATTACHMENT_NOT_USABLE, "A file is listed twice");
		}
		for (UUID fileId : fileIds) {
			if (attachedHere.contains(fileId)) {
				continue;
			}
			try {
				storage.stored(fileId, FilePurpose.USE_CASE_ATTACHMENT, actor);
			}
			catch (StorageException notUsable) {
				throw new UseCaseException(UseCaseErrorCode.ATTACHMENT_NOT_USABLE,
						"File " + fileId + " is not a stored attachment of the caller", notUsable);
			}
			if (useCases.attachmentExists(fileId)) {
				throw new UseCaseException(UseCaseErrorCode.ATTACHMENT_NOT_USABLE,
						"File " + fileId + " is attached already");
			}
		}
	}

	/** The files of a use case, in the order they were attached. */
	List<UseCaseAttachmentResponse> of(UseCase useCase) {
		Map<UUID, StoredFile> files = storage.describe(useCase.getAttachmentFileIds());
		return useCase.getAttachmentFileIds()
			.stream()
			.map(files::get)
			.filter(Objects::nonNull)
			.map(file -> new UseCaseAttachmentResponse(file.id(), file.fileName(), file.mediaType(), file.sizeBytes()))
			.toList();
	}
}
