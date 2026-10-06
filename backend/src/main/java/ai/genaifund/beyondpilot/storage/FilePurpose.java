package ai.genaifund.beyondpilot.storage;

import java.util.Set;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Why a file is uploaded. The purpose fixes which media types are accepted, who may upload and whether anyone may
 * read the file; the largest size is configuration ({@link StorageProperties}). A module adds its purpose with the
 * first screen that uploads for it.
 */
public enum FilePurpose {

	/** A cover or a person's photo on a program's page. */
	PROGRAM_IMAGE("program_image", true, true, Set.of("image/png", "image/jpeg", "image/webp")),

	/** The photo of a person on their talent profile, which they upload themselves. */
	TALENT_PHOTO("talent_photo", true, false, Set.of("image/png", "image/jpeg", "image/webp")),

	/** The logo of an organization, which one of its owners uploads. */
	ORGANIZATION_LOGO("organization_logo", true, false, Set.of("image/png", "image/jpeg", "image/webp")),

	/** A deck or a proposal attached to an application. */
	APPLICATION_FILE("application_file", false, false, Set.of("application/pdf")),

	/** The deck of a solution. The solution module decides who reads it. */
	SOLUTION_DECK("solution_deck", false, false, Set.of("application/pdf"));

	private final String value;
	private final boolean publicRead;
	private final boolean operatorOnly;
	private final Set<String> mediaTypes;

	FilePurpose(String value, boolean publicRead, boolean operatorOnly, Set<String> mediaTypes) {
		this.value = value;
		this.publicRead = publicRead;
		this.operatorOnly = operatorOnly;
		this.mediaTypes = mediaTypes;
	}

	/** The code stored in the database and sent over HTTP. */
	@JsonValue
	public String value() {
		return value;
	}

	/** Whether a stored file of this purpose is served to anyone who has its address. */
	public boolean publicRead() {
		return publicRead;
	}

	/** Whether only an operator may upload for this purpose. */
	public boolean operatorOnly() {
		return operatorOnly;
	}

	public Set<String> mediaTypes() {
		return mediaTypes;
	}
}
