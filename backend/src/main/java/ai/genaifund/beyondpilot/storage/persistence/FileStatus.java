package ai.genaifund.beyondpilot.storage.persistence;

public enum FileStatus {
	/** Reserved; its bytes have not been confirmed, and nobody can read it. */
	PENDING,
	STORED
}
