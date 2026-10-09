package ai.genaifund.beyondpilot.proposal;

import java.util.List;
import java.util.regex.Pattern;

import org.jspecify.annotations.Nullable;

/**
 * Rows of text as RFC 4180 writes them. A cell that a spreadsheet would run as a formula is written as text, since
 * what an applicant typed is opened by an operator; a phone number keeps its leading plus.
 */
final class CsvRows {

	/** A phone number or a figure: a leading sign with nothing a spreadsheet could call. */
	private static final Pattern NUMBER = Pattern.compile("[+-]?[0-9 ().-]*");

	private final StringBuilder text = new StringBuilder();

	void add(List<@Nullable Object> cells) {
		for (int index = 0; index < cells.size(); index++) {
			if (index > 0) {
				text.append(',');
			}
			text.append(cell(cells.get(index)));
		}
		text.append("\r\n");
	}

	@Override
	public String toString() {
		return text.toString();
	}

	private static String cell(@Nullable Object value) {
		if (value == null) {
			return "";
		}
		String written = value.toString();
		if (!written.isEmpty() && "=+-@\t\r".indexOf(written.charAt(0)) >= 0 && !NUMBER.matcher(written).matches()) {
			written = "'" + written;
		}
		return written.contains(",") || written.contains("\"") || written.contains("\n") || written.contains("\r")
				? "\"" + written.replace("\"", "\"\"") + "\"" : written;
	}

}
