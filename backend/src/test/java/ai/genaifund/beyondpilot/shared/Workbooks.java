package ai.genaifund.beyondpilot.shared;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.List;

import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

/** A downloaded workbook read back as a test compares it: the first sheet's rows as an operator sees them. */
public final class Workbooks {

	private Workbooks() {
	}

	/**
	 * Every row of the first sheet, header rows included, each cell as Excel shows it and trailing blank cells left
	 * out.
	 */
	public static List<List<String>> rows(byte[] xlsx) {
		try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(xlsx))) {
			Sheet sheet = workbook.getSheetAt(0);
			DataFormatter shown = new DataFormatter();
			List<List<String>> rows = new ArrayList<>();
			for (int index = 0; index <= sheet.getLastRowNum(); index++) {
				Row row = sheet.getRow(index);
				List<String> cells = new ArrayList<>();
				if (row != null) {
					for (int column = 0; column < row.getLastCellNum(); column++) {
						cells.add(shown.formatCellValue(row.getCell(column)));
					}
				}
				while (!cells.isEmpty() && cells.getLast().isEmpty()) {
					cells.removeLast();
				}
				rows.add(cells);
			}
			return rows;
		}
		catch (IOException error) {
			throw new UncheckedIOException(error);
		}
	}

}
