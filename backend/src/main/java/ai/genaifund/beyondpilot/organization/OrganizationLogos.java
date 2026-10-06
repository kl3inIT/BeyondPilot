package ai.genaifund.beyondpilot.organization;

import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.organization.persistence.OrganizationRepository;
import ai.genaifund.beyondpilot.storage.FilePurpose;
import ai.genaifund.beyondpilot.storage.StorageException;
import ai.genaifund.beyondpilot.storage.StorageService;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

/** The logos organizations name, for an owner's profile and an operator's alike. */
@Component
class OrganizationLogos {

	private final OrganizationRepository organizations;

	private final StorageService storage;

	OrganizationLogos(OrganizationRepository organizations, StorageService storage) {
		this.organizations = organizations;
		this.storage = storage;
	}

	/**
	 * A logo is a stored image the caller uploaded for an organization, and the logo of no other.
	 * @throws OrganizationException when the file is not such an image, or another organization names it
	 */
	void requireUsable(Actor actor, UUID logo) {
		try {
			storage.stored(logo, FilePurpose.ORGANIZATION_LOGO, actor);
		}
		catch (StorageException notUsable) {
			throw new OrganizationException(OrganizationErrorCode.LOGO_NOT_USABLE,
					"File " + logo + " as an organization logo: " + notUsable.code());
		}
		if (organizations.existsByLogoFileId(logo)) {
			throw new OrganizationException(OrganizationErrorCode.LOGO_NOT_USABLE,
					"File " + logo + " is another organization's logo");
		}
	}

	/** Removes the former logo once the organization names another or none, so nobody reads it again. */
	void discardReplaced(@Nullable UUID former, @Nullable UUID logo) {
		if (former != null && !former.equals(logo)) {
			storage.delete(former);
		}
	}

}
