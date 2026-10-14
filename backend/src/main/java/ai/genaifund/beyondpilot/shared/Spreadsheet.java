package ai.genaifund.beyondpilot.shared;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.function.Function;
import java.util.function.IntFunction;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

import org.apache.fesod.sheet.enums.CellDataTypeEnum;
import org.apache.fesod.sheet.ExcelWriter;
import org.apache.fesod.sheet.FesodSheet;
import org.apache.fesod.sheet.metadata.data.DataFormatData;
import org.apache.fesod.sheet.metadata.data.HyperlinkData;
import org.apache.fesod.sheet.metadata.data.WriteCellData;
import org.apache.fesod.sheet.support.ExcelTypeEnum;
import org.apache.fesod.sheet.write.handler.context.SheetWriteHandlerContext;
import org.apache.fesod.sheet.write.handler.SheetWriteHandler;
import org.apache.fesod.sheet.write.metadata.style.WriteCellStyle;
import org.apache.fesod.sheet.write.metadata.style.WriteFont;
import org.apache.fesod.sheet.write.metadata.WriteSheet;
import org.apache.fesod.sheet.write.style.HorizontalCellStyleStrategy;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.FontUnderline;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.util.CellRangeAddress;
import org.jspecify.annotations.Nullable;

/**
 * A list as operators download it: the columns are declared once, and the same rows are written as an Excel workbook
 * to read or as CSV for another tool.
 * <p>
 * The workbook is styled for reading: a bold header on a grey band that stays in view, a filter on every column,
 * columns as wide as what they hold, times as dates in Vietnam time, figures as numbers, addresses that open, and a
 * second sheet that says what the file holds, how it was narrowed, who downloaded it and when. In CSV a cell that a
 * spreadsheet would run as a formula is written as text, since what people typed is opened by an operator.
 * @param <T> the record of one row
 */
public final class Spreadsheet<T> {

	/** Where GenAI Fund works: every time in a download is read there. */
	public static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

	private static final DateTimeFormatter DAY_TEXT = DateTimeFormatter.ofPattern("yyyy-MM-dd", Locale.ROOT);

	private static final DateTimeFormatter TIME_TEXT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm", Locale.ROOT);

	/** A phone number or a figure: a leading sign with nothing a spreadsheet could call. */
	private static final Pattern NUMBER = Pattern.compile("[+-]?[0-9 ().-]*");

	/** The most rows a download holds, so that writing one keeps to bounded memory. */
	public static final int MOST_ROWS = 10_000;

	/** How many rows {@link #everyPage} asks a list for at a time. */
	public static final int PAGE_SIZE = 100;

	private static final int NARROWEST = 8;

	private static final int WIDEST = 50;

	private final String title;

	private final List<Column<T>> columns = new ArrayList<>();

	private @Nullable String group;

	private Spreadsheet(String title) {
		this.title = title;
	}

	/**
	 * A spreadsheet whose rows are of one kind.
	 * @param title what the list is, such as "Organizations"; it names the sheet
	 */
	public static <T> Spreadsheet<T> of(String title) {
		return new Spreadsheet<>(title);
	}

	/** The columns declared next sit under one heading, until the next group or {@link #ungrouped()}. */
	public Spreadsheet<T> group(String heading) {
		group = heading;
		return this;
	}

	/** The columns declared next sit under no heading. */
	public Spreadsheet<T> ungrouped() {
		group = null;
		return this;
	}

	/** Text on one line. */
	public Spreadsheet<T> text(String header, Function<? super T, ? extends @Nullable Object> value) {
		return add(header, Kind.TEXT, value);
	}

	/** Text that may run long, such as a summary: the column is wide and the text wraps. */
	public Spreadsheet<T> paragraph(String header, Function<? super T, ? extends @Nullable Object> value) {
		return add(header, Kind.PARAGRAPH, value);
	}

	/**
	 * A code read as words: {@code under_review} or {@code UNDER_REVIEW} is written "Under review".
	 */
	public Spreadsheet<T> label(String header, Function<? super T, ? extends @Nullable Object> value) {
		return add(header, Kind.LABEL, value);
	}

	/** A whole number. */
	public Spreadsheet<T> count(String header, Function<? super T, ? extends @Nullable Number> value) {
		return add(header, Kind.COUNT, value);
	}

	/** A figure shown with two decimals, such as an average score. */
	public Spreadsheet<T> decimal(String header, Function<? super T, ? extends @Nullable Number> value) {
		return add(header, Kind.DECIMAL, value);
	}

	/** An amount in US dollars, with the four decimals a model's call costs. */
	public Spreadsheet<T> dollars(String header, Function<? super T, ? extends @Nullable Number> value) {
		return add(header, Kind.DOLLARS, value);
	}

	/** A moment, written as a date and time in Vietnam time. */
	public Spreadsheet<T> time(String header, Function<? super T, ? extends @Nullable Instant> value) {
		return add(header, Kind.TIME, value);
	}

	/** A day. */
	public Spreadsheet<T> day(String header, Function<? super T, ? extends @Nullable LocalDate> value) {
		return add(header, Kind.DAY, value);
	}

	/** Yes or No. */
	public Spreadsheet<T> yesNo(String header, Function<? super T, ? extends @Nullable Boolean> value) {
		return add(header, Kind.YES_NO, value);
	}

	/** An email address that opens a new message. */
	public Spreadsheet<T> email(String header, Function<? super T, ? extends @Nullable String> value) {
		return add(header, Kind.EMAIL, value);
	}

	/** A web address that opens in the browser; anything but http and https stays text. */
	public Spreadsheet<T> link(String header, Function<? super T, ? extends @Nullable String> value) {
		return add(header, Kind.LINK, value);
	}

	/**
	 * Every row of a list paged from 1, read through the list's own method a page at a time, so a download holds what
	 * the screen narrows, in its order.
	 * @param page reads one page of {@link #PAGE_SIZE} rows, the first being 1
	 * @throws SpreadsheetException when the list holds more than {@link #MOST_ROWS} rows
	 */
	public static <R> List<R> everyPage(IntFunction<? extends List<? extends R>> page) {
		List<R> rows = new ArrayList<>();
		for (int number = 1;; number++) {
			List<? extends R> items = page.apply(number);
			rows.addAll(items);
			bounded(rows.size());
			if (items.size() < PAGE_SIZE) {
				return rows;
			}
		}
	}

	/**
	 * Refuses a download that would hold more than {@link #MOST_ROWS} rows.
	 * @throws SpreadsheetException when it would
	 */
	public static void bounded(int rows) {
		if (rows > MOST_ROWS) {
			throw new SpreadsheetException(SpreadsheetErrorCode.TOO_LARGE,
					"A download of more than " + MOST_ROWS + " rows was asked for");
		}
	}

	/**
	 * The rows written in the format asked for.
	 * @param format the file to write
	 * @param name the start of the file's name, such as {@code organizations}; the day it was downloaded follows it
	 * @param rows the records, in the order the file lists them
	 * @param about who downloaded the list, when, and how it was narrowed
	 * @throws SpreadsheetException when there are more than {@link #MOST_ROWS} rows
	 */
	public SpreadsheetFile write(SpreadsheetFormat format, String name, List<? extends T> rows, About about) {
		bounded(rows.size());
		String fileName = name + "-" + DAY_TEXT.format(about.at().atZone(ZONE)) + "." + format.extension();
		byte[] content = switch (format) {
			case XLSX -> workbook(rows, about);
			case CSV -> csv(rows);
		};
		return new SpreadsheetFile(fileName, format, content, rows.size());
	}

	private Spreadsheet<T> add(String header, Kind kind, Function<? super T, ?> value) {
		columns.add(new Column<>(group, header, kind, value));
		return this;
	}

	private byte[] workbook(List<? extends T> rows, About about) {
		boolean grouped = columns.stream().anyMatch(column -> column.group() != null);
		int headRows = grouped ? 2 : 1;
		List<List<String>> head = new ArrayList<>();
		for (Column<T> column : columns) {
			String group = column.group();
			head.add(!grouped ? List.of(column.header())
					: List.of(group == null ? column.header() : group, column.header()));
		}
		List<WriteCellStyle> styles = columns.stream().map(column -> column.kind().style()).toList();
		List<List<Object>> cells = new ArrayList<>();
		int[] widths = columns.stream().mapToInt(column -> column.header().length()).toArray();
		for (T row : rows) {
			List<Object> line = new ArrayList<>(columns.size());
			for (int index = 0; index < columns.size(); index++) {
				Column<T> column = columns.get(index);
				@Nullable Object value = column.value().apply(row);
				line.add(column.kind().cell(value, styles.get(index)));
				widths[index] = Math.max(widths[index], column.kind().written(value).length());
			}
			cells.add(line);
		}
		ByteArrayOutputStream out = new ByteArrayOutputStream();
		try (ExcelWriter writer = FesodSheet.write(out).excelType(ExcelTypeEnum.XLSX).useDefaultStyle(false).build()) {
			WriteSheet list = FesodSheet.writerSheet(0, sheetName(title))
				.head(head)
				.registerWriteHandler(new HorizontalCellStyleStrategy(headStyle(), (WriteCellStyle) null))
				.registerWriteHandler(new Frame(headRows, rows.size(), widths, columns))
				.build();
			writer.write(cells, list);
			WriteSheet aboutSheet = FesodSheet.writerSheet(1, "About")
				.needHead(false)
				.registerWriteHandler(new Frame(0, 0, new int[] { 14, WIDEST }, List.of()))
				.build();
			writer.write(about.lines(title, rows.size()), aboutSheet);
		}
		return out.toByteArray();
	}

	private byte[] csv(List<? extends T> rows) {
		List<List<String>> head = columns.stream().map(column -> List.of(column.header())).toList();
		List<List<Object>> lines = new ArrayList<>();
		for (T row : rows) {
			List<Object> line = new ArrayList<>(columns.size());
			for (Column<T> column : columns) {
				line.add(safe(column.kind().written(column.value().apply(row))));
			}
			lines.add(line);
		}
		ByteArrayOutputStream out = new ByteArrayOutputStream();
		// The byte order mark tells Excel the file is UTF-8, so names keep their accents.
		FesodSheet.write(out)
			.excelType(ExcelTypeEnum.CSV)
			.charset(StandardCharsets.UTF_8)
			.withBom(true)
			.head(head)
			.sheet()
			.doWrite(lines);
		return out.toByteArray();
	}

	/** A cell a spreadsheet would run as a formula is written as text; a phone number keeps its leading plus. */
	static String safe(String written) {
		return !written.isEmpty() && "=+-@\t\r".indexOf(written.charAt(0)) >= 0 && !NUMBER.matcher(written).matches()
				? "'" + written : written;
	}

	/** A sheet's name: Excel takes 31 characters at most and none of {@code \ / ? * [ ] :}. */
	private static String sheetName(String title) {
		String name = title.replaceAll("[\\\\/?*\\[\\]:]", " ").strip();
		return name.length() > 31 ? name.substring(0, 31) : name;
	}

	private static WriteCellStyle headStyle() {
		WriteCellStyle style = new WriteCellStyle();
		WriteFont font = new WriteFont();
		font.setBold(true);
		style.setWriteFont(font);
		style.setFillPatternType(FillPatternType.SOLID_FOREGROUND);
		style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
		style.setBorderBottom(BorderStyle.THIN);
		style.setHorizontalAlignment(HorizontalAlignment.LEFT);
		style.setVerticalAlignment(VerticalAlignment.CENTER);
		style.setWrapped(true);
		return style;
	}

	/**
	 * Who downloaded a list, when, and how it was narrowed, as the second sheet of a workbook says.
	 * @param by the operator who downloaded it
	 * @param at when
	 * @param narrowed each filter that was set, by its name, in the order the list shows them; empty when the list
	 * was downloaded whole
	 */
	public record About(String by, Instant at, Map<String, String> narrowed) {

		public About {
			narrowed = Collections.unmodifiableMap(new LinkedHashMap<>(narrowed));
		}

		/** A list downloaded whole. */
		public static About of(String by, Instant at) {
			return new About(by, at, Map.of());
		}

		/** The same, with one more filter that was set; a filter left empty is not named. */
		public About narrowedBy(String name, @Nullable Object value) {
			if (value == null || value.toString().isBlank()) {
				return this;
			}
			Map<String, String> more = new LinkedHashMap<>(narrowed);
			more.put(name, value.toString());
			return new About(by, at, more);
		}

		private List<List<Object>> lines(String title, int rows) {
			List<List<Object>> lines = new ArrayList<>();
			lines.add(List.of("List", title));
			lines.add(List.of("Rows", rows));
			lines.add(List.of("Narrowed by", narrowed.isEmpty() ? "Nothing: every row" : ""));
			narrowed.forEach((name, value) -> lines.add(List.of("", name + ": " + value)));
			lines.add(List.of("Downloaded by", by));
			lines.add(List.of("Downloaded at", TIME_TEXT.format(at.atZone(ZONE)) + " (Vietnam time)"));
			lines.add(List.of("Times", "Every time in this file is Vietnam time (UTC+7)"));
			return lines;
		}

	}

	private record Column<T>(@Nullable String group, String header, Kind kind, Function<? super T, ?> value) {
	}

	/**
	 * The frame of a sheet, set before its rows: the header stays in view, every column has a filter, and each column
	 * is as wide as what it holds, within bounds.
	 */
	private static final class Frame implements SheetWriteHandler {

		private final int headRows;

		private final int rows;

		private final int[] widths;

		private final List<? extends Column<?>> columns;

		private Frame(int headRows, int rows, int[] widths, List<? extends Column<?>> columns) {
			this.headRows = headRows;
			this.rows = rows;
			this.widths = widths;
			this.columns = columns;
		}

		@Override
		public void afterSheetCreate(SheetWriteHandlerContext context) {
			Sheet sheet = context.getWriteSheetHolder().getSheet();
			for (int index = 0; index < widths.length; index++) {
				int widest = index < columns.size() && columns.get(index).kind() == Kind.PARAGRAPH ? 60 : WIDEST;
				int characters = Math.min(widest, Math.max(NARROWEST, widths[index] + 2));
				sheet.setColumnWidth(index, characters * 256);
			}
			if (headRows > 0) {
				sheet.createFreezePane(0, headRows);
				sheet.setAutoFilter(new CellRangeAddress(headRows - 1, headRows - 1 + Math.max(rows, 1), 0,
						widths.length - 1));
			}
		}

	}

	/** How a column writes its values, in a workbook and as text. */
	private enum Kind {

		TEXT, PARAGRAPH, LABEL, COUNT, DECIMAL, DOLLARS, TIME, DAY, YES_NO, EMAIL, LINK;

		WriteCellStyle style() {
			WriteCellStyle style = new WriteCellStyle();
			style.setVerticalAlignment(VerticalAlignment.TOP);
			switch (this) {
				case PARAGRAPH -> style.setWrapped(true);
				case COUNT -> style.setDataFormatData(format("0"));
				case DECIMAL -> style.setDataFormatData(format("0.00"));
				case DOLLARS -> style.setDataFormatData(format("$#,##0.0000"));
				case TIME -> style.setDataFormatData(format("yyyy-mm-dd hh:mm"));
				case DAY -> style.setDataFormatData(format("yyyy-mm-dd"));
				case EMAIL, LINK -> {
					WriteFont font = new WriteFont();
					font.setColor(IndexedColors.BLUE.getIndex());
					font.setUnderline(FontUnderline.SINGLE.getByteValue());
					style.setWriteFont(font);
				}
				default -> {
				}
			}
			return style;
		}

		WriteCellData<?> cell(@Nullable Object value, WriteCellStyle style) {
			if (value == null) {
				return new WriteCellData<>(CellDataTypeEnum.EMPTY);
			}
			WriteCellData<?> cell = switch (this) {
				case COUNT, DECIMAL, DOLLARS -> new WriteCellData<>(new BigDecimal(value.toString()));
				case TIME -> new WriteCellData<>(LocalDateTime.ofInstant((Instant) value, ZONE));
				case DAY -> new WriteCellData<>(((LocalDate) value).atStartOfDay());
				case EMAIL -> linked(value.toString(), "mailto:" + value);
				case LINK -> opens(value.toString()) ? linked(value.toString(), value.toString())
						: new WriteCellData<>(value.toString());
				default -> new WriteCellData<>(written(value));
			};
			if (this == LINK && !opens(value.toString())) {
				return cell;
			}
			cell.setWriteCellStyle(style);
			return cell;
		}

		String written(@Nullable Object value) {
			if (value == null) {
				return "";
			}
			return switch (this) {
				case LABEL -> words(value);
				case YES_NO -> Boolean.TRUE.equals(value) ? "Yes" : "No";
				case TIME -> TIME_TEXT.format(((Instant) value).atZone(ZONE));
				case DAY -> DAY_TEXT.format((LocalDate) value);
				case DECIMAL -> new BigDecimal(value.toString()).setScale(2, RoundingMode.HALF_UP).toPlainString();
				default -> value instanceof Enum<?> code ? words(code.name()) : value.toString();
			};
		}

		private static WriteCellData<?> linked(String text, String address) {
			WriteCellData<String> cell = new WriteCellData<>(text);
			HyperlinkData link = new HyperlinkData();
			link.setAddress(address);
			link.setHyperlinkType(address.startsWith("mailto:") ? HyperlinkData.HyperlinkType.EMAIL
					: HyperlinkData.HyperlinkType.URL);
			cell.setHyperlinkData(link);
			return cell;
		}

		private static boolean opens(String address) {
			String lower = address.toLowerCase(Locale.ROOT);
			return lower.startsWith("https://") || lower.startsWith("http://");
		}

		private static String words(Object code) {
			String spaced = Objects.toString(code).replace('_', ' ').replace('-', ' ').strip().toLowerCase(Locale.ROOT);
			return spaced.isEmpty() ? spaced : Character.toUpperCase(spaced.charAt(0)) + spaced.substring(1);
		}

		private static DataFormatData format(String pattern) {
			DataFormatData data = new DataFormatData();
			data.setFormat(pattern);
			return data;
		}

	}

}
