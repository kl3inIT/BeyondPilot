package ai.genaifund.beyondpilot.proposal.dto;

/**
 * A program's applications as a spreadsheet reads them.
 * @param fileName the name the download is saved under
 * @param content the rows in CSV, the header first
 */
public record ApplicationsCsv(String fileName, String content) {
}
