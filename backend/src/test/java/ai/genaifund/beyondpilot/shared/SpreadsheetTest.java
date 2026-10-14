package ai.genaifund.beyondpilot.shared;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

import org.apache.poi.common.usermodel.HyperlinkType;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.Test;

class SpreadsheetTest {

	private static final Instant AT = Instant.parse("2026-10-14T02:30:00Z");

	private static final Spreadsheet.About ABOUT = new Spreadsheet.About("Lan Operator", AT,
			Map.of("Status", "Under review"));

	@Test
	void aWorkbookIsStyledForReadingAndSaysWhatItHolds() throws Exception {
		SpreadsheetFile file = applications().write(SpreadsheetFormat.XLSX, "tasco-applications",
				List.of(new Row("Công ty Cổ phần Tasco", "an@tasco.vn", "https://tasco.vn", "under_review", 8.256, 3,
						AT, true, "A summary\nover two lines"),
						new Row("=HYPERLINK(\"http://evil\")", "b@x.io", "javascript:alert(1)", null, null, null, null,
								false, null)),
				ABOUT);

		assertThat(file.fileName()).isEqualTo("tasco-applications-2026-10-14.xlsx");
		assertThat(file.rows()).isEqualTo(2);
		try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(file.content()))) {
			XSSFSheet sheet = workbook.getSheetAt(0);
			DataFormatter shown = new DataFormatter();
			assertThat(sheet.getSheetName()).isEqualTo("Applications");
			// Two header rows: the groups over their columns, a column without a group across both.
			assertThat(text(sheet, 0)).containsExactly("Organization", "Contact", "Contact", "Review", "Review", "Review",
					"Review", "Review", "Summary");
			assertThat(text(sheet, 1)).containsExactly("Organization", "Email", "Website", "Status", "Average", "Scores",
					"Submitted at", "Shortlisted", "Summary");
			assertThat(sheet.getMergedRegions()).contains(CellRangeAddress.valueOf("B1:C1"),
					CellRangeAddress.valueOf("D1:H1"), CellRangeAddress.valueOf("A1:A2"));
			Cell header = sheet.getRow(1).getCell(1);
			assertThat(workbook.getFontAt(header.getCellStyle().getFontIndex()).getBold()).isTrue();
			// The header stays in view and every column filters.
			assertThat(sheet.getPaneInformation().getHorizontalSplitPosition()).isEqualTo((short) 2);
			assertThat(sheet.getCTWorksheet().getAutoFilter().getRef()).isEqualTo("A2:I4");

			var first = sheet.getRow(2);
			assertThat(first.getCell(0).getStringCellValue()).isEqualTo("Công ty Cổ phần Tasco");
			assertThat(first.getCell(1).getHyperlink().getAddress()).isEqualTo("mailto:an@tasco.vn");
			assertThat(first.getCell(1).getHyperlink().getType()).isEqualTo(HyperlinkType.EMAIL);
			assertThat(first.getCell(2).getHyperlink().getAddress()).isEqualTo("https://tasco.vn");
			assertThat(first.getCell(3).getStringCellValue()).isEqualTo("Under review");
			// Figures are numbers and times are dates in Vietnam time, so Excel sorts and sums them.
			assertThat(first.getCell(4).getCellType()).isEqualTo(CellType.NUMERIC);
			assertThat(shown.formatCellValue(first.getCell(4))).isEqualTo("8.26");
			assertThat(first.getCell(5).getNumericCellValue()).isEqualTo(3);
			assertThat(first.getCell(6).getCellType()).isEqualTo(CellType.NUMERIC);
			assertThat(shown.formatCellValue(first.getCell(6))).isEqualTo("2026-10-14 09:30");
			assertThat(first.getCell(7).getStringCellValue()).isEqualTo("Yes");
			assertThat(first.getCell(8).getCellStyle().getWrapText()).isTrue();

			var second = sheet.getRow(3);
			// What someone typed stays text: it is never run as a formula, and an address that is not the web never opens.
			assertThat(second.getCell(0).getCellType()).isEqualTo(CellType.STRING);
			assertThat(second.getCell(2).getHyperlink()).isNull();
			assertThat(second.getCell(2).getStringCellValue()).isEqualTo("javascript:alert(1)");
			assertThat(second.getCell(4) == null || second.getCell(4).getCellType() == CellType.BLANK).isTrue();

			assertThat(sheet.getColumnWidth(0) / 256).isBetween(20, 30);

			Sheet about = workbook.getSheet("About");
			List<String> lines = new ArrayList<>();
			about.forEach(row -> lines.add(shown.formatCellValue(row.getCell(0)) + "|" + shown.formatCellValue(row.getCell(1))));
			assertThat(lines).containsExactly("List|Applications", "Rows|2", "Narrowed by|", "|Status: Under review",
					"Downloaded by|Lan Operator", "Downloaded at|2026-10-14 09:30 (Vietnam time)",
					"Times|Every time in this file is Vietnam time (UTC+7)");
		}
	}

	@Test
	void aLongListKeepsAFewCellStyles() throws Exception {
		List<Row> rows = IntStream.range(0, 2000)
			.mapToObj(index -> new Row("Org " + index, "p" + index + "@x.io", null, "submitted", 7.5, index, AT, true,
					null))
			.toList();

		SpreadsheetFile file = applications().write(SpreadsheetFormat.XLSX, "many", rows, Spreadsheet.About.of("Lan", AT));

		try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(file.content()))) {
			assertThat(workbook.getSheetAt(0).getLastRowNum()).isEqualTo(2001);
			// Excel opens at most 64,000 styles: one per column, not one per cell.
			assertThat(workbook.getNumCellStyles()).isLessThan(30);
		}
	}

	@Test
	void csvQuotesWhereItMustAndNeverRunsAFormula() {
		Spreadsheet<List<@Nullable String>> sheet = Spreadsheet.<List<@Nullable String>>of("Cells")
			.text("A", row -> row.get(0))
			.text("B", row -> row.get(1))
			.text("C", row -> row.get(2))
			.text("D", row -> row.get(3))
			.text("E", row -> row.get(4))
			.text("F", row -> row.get(5));
		List<List<@Nullable String>> rows = List.of(
				Arrays.asList("Pocket, Policy", "He said \"go\"", null, "3", "two\nlines", "Việt Nam"),
				List.of("=1+1", "+84 912 345 678", "-2", "@sum", "+cmd|x", "plain"));

		SpreadsheetFile file = sheet.write(SpreadsheetFormat.CSV, "cells", rows, Spreadsheet.About.of("Lan", AT));

		assertThat(file.fileName()).isEqualTo("cells-2026-10-14.csv");
		assertThat(new String(file.content(), StandardCharsets.UTF_8)).isEqualTo("﻿A,B,C,D,E,F\r\n"
				+ "\"Pocket, Policy\",\"He said \"\"go\"\"\",,3,\"two\nlines\",Việt Nam\r\n"
				+ "'=1+1,+84 912 345 678,-2,'@sum,'+cmd|x,plain\r\n");
	}

	@Test
	void everyPageOfAListIsReadAndAListTooLongIsRefused() {
		List<Integer> asked = new ArrayList<>();

		List<Integer> rows = Spreadsheet.everyPage(page -> {
			asked.add(page);
			int from = (page - 1) * Spreadsheet.PAGE_SIZE;
			return IntStream.range(from, Math.min(from + Spreadsheet.PAGE_SIZE, 250)).boxed().toList();
		});

		assertThat(asked).containsExactly(1, 2, 3);
		assertThat(rows).hasSize(250).startsWith(0, 1).endsWith(249);
		assertThatThrownBy(() -> Spreadsheet.everyPage(page -> IntStream.range(0, Spreadsheet.PAGE_SIZE).boxed().toList()))
			.isInstanceOf(SpreadsheetException.class)
			.extracting(error -> ((SpreadsheetException) error).code())
			.isEqualTo("SPREADSHEET_TOO_LARGE");
	}

	private static Spreadsheet<Row> applications() {
		return Spreadsheet.<Row>of("Applications")
			.text("Organization", Row::organization)
			.group("Contact")
			.email("Email", Row::email)
			.link("Website", Row::website)
			.group("Review")
			.label("Status", Row::status)
			.decimal("Average", Row::average)
			.count("Scores", Row::scores)
			.time("Submitted at", Row::submittedAt)
			.yesNo("Shortlisted", Row::shortlisted)
			.ungrouped()
			.paragraph("Summary", Row::summary);
	}

	private static List<String> text(Sheet sheet, int row) {
		List<String> cells = new ArrayList<>();
		sheet.getRow(row).forEach(cell -> cells.add(cell.getStringCellValue()));
		return cells;
	}

	private record Row(String organization, String email, @Nullable String website, @Nullable String status,
			@Nullable Double average, @Nullable Integer scores, @Nullable Instant submittedAt, boolean shortlisted,
			@Nullable String summary) {
	}

}
