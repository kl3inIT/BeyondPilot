package ai.genaifund.beyondpilot.shared;

import java.util.Locale;

/**
 * The file a list is downloaded as: an Excel workbook, styled for reading, or plain CSV for another tool.
 */
public enum SpreadsheetFormat {

	XLSX(SpreadsheetFormat.XLSX_TYPE),

	CSV(SpreadsheetFormat.CSV_TYPE);

	/** The media type of a workbook, as a controller declares what it produces. */
	public static final String XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

	/** The media type of CSV, as a controller declares what it produces. */
	public static final String CSV_TYPE = "text/csv";

	/** The pattern a request's {@code format} matches, before {@link #of(String)} reads it. */
	public static final String PATTERN = "xlsx|csv";

	/** What a request's {@code format} means, as the API documents it. */
	public static final String DESCRIPTION = "The file: xlsx, an Excel workbook to read, or csv for another tool.";

	private final String contentType;

	SpreadsheetFormat(String contentType) {
		this.contentType = contentType;
	}

	/**
	 * The format a request names by its extension, {@code xlsx} or {@code csv}.
	 * @throws IllegalArgumentException for any other name, which the request's validation refuses first
	 */
	public static SpreadsheetFormat of(String extension) {
		return valueOf(extension.toUpperCase(Locale.ROOT));
	}

	/** The media type of the file; CSV says it is UTF-8. */
	public String contentType() {
		return this == CSV ? contentType + ";charset=UTF-8" : contentType;
	}

	public String extension() {
		return name().toLowerCase(Locale.ROOT);
	}

}
