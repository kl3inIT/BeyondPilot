package ai.genaifund.beyondpilot.shared;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.core.io.InputStreamSource;

/**
 * What PDFBox gives of a PDF: the text each page holds, and the picture of a page. No model is involved. AI reads
 * decks and attachments with it; the operators' MCP server shows an application's files with it.
 */
public final class PdfPages {

	/** Enough to read a slide's text, and about 1,200 tokens for a model that reads images. */
	private static final float PICTURE_DPI = 110;

	/**
	 * The longest side of a picture, in pixels. A slide or an A4 page at 110 DPI stays well under it. A page laid out
	 * as a poster does not: one of 3,840 by 5,430 points is 49 megapixels at 110 DPI, which AI Hay refused page
	 * after page (staging, 9 October 2026), and its text was read once drawn at this size.
	 */
	private static final float MAX_PICTURE_SIDE = 2200;

	/** Tried in order until a page fits: a slide stays readable down to the last. */
	private static final float[] JPEG_QUALITIES = { 0.85f, 0.7f, 0.55f, 0.4f };

	private PdfPages() {
	}

	/** The text of each page, in order, up to a number of pages; an empty string for a page without text. */
	public static List<String> text(InputStreamSource pdf, int maxPages) throws IOException {
		try (PDDocument document = load(pdf)) {
			return text(document, 1, Math.min(document.getNumberOfPages(), maxPages));
		}
	}

	/**
	 * Up to a number of pages from a first one, each with its text and its picture as {@link #jpegs} draws it, and how
	 * many pages the file has, reading the file once. A first page past the end gives no page.
	 */
	public static Pages pages(InputStreamSource pdf, int first, int maxPages, int maxBytes) throws IOException {
		try (PDDocument document = load(pdf)) {
			int count = document.getNumberOfPages();
			int from = Math.max(first, 1);
			int last = Math.min(count, from + maxPages - 1);
			List<String> text = text(document, from, last);
			PDFRenderer renderer = new PDFRenderer(document);
			List<Page> pages = new ArrayList<>();
			for (int page = from; page <= last; page++) {
				pages.add(new Page(page, text.get(page - from), fitted(drawn(document, renderer, page), maxBytes)));
			}
			return new Pages(count, List.copyOf(pages));
		}
	}

	/** Pages of a PDF and how many it has. */
	public record Pages(int count, List<Page> pages) {
	}

	/**
	 * One page.
	 * @param number from 1
	 * @param text empty for a page without text
	 * @param jpeg empty when the picture stays over the limit at the lowest quality
	 */
	public record Page(int number, String text, byte[] jpeg) {
	}

	/**
	 * A page's text without the characters no text holds: a font without a mapping gives the null character, which
	 * PostgreSQL refuses in a text, and other control characters. Line ends and tabs stay.
	 */
	static String clean(String text) {
		StringBuilder kept = new StringBuilder(text.length());
		text.codePoints()
			.filter(character -> character == '\n' || character == '\t' || !Character.isISOControl(character))
			.forEach(kept::appendCodePoint);
		return kept.toString().strip();
	}

	/**
	 * The pictures of these pages as JPEG no larger than a limit, for a model or a service that takes no more: by page number
	 * from 1, a page the file does not have left out. A page that stays over the limit at the lowest quality is an
	 * empty array, so the caller knows it was drawn and cannot be sent.
	 */
	public static Map<Integer, byte[]> jpegs(InputStreamSource pdf, List<Integer> pages, int maxBytes) throws IOException {
		try (PDDocument document = load(pdf)) {
			PDFRenderer renderer = new PDFRenderer(document);
			Map<Integer, byte[]> pictures = new LinkedHashMap<>();
			for (int page : pages) {
				if (page >= 1 && page <= document.getNumberOfPages()) {
					pictures.put(page, fitted(drawn(document, renderer, page), maxBytes));
				}
			}
			return pictures;
		}
	}

	private static PDDocument load(InputStreamSource pdf) throws IOException {
		try (InputStream content = pdf.getInputStream()) {
			return Loader.loadPDF(content.readAllBytes());
		}
	}

	/** The text of pages {@code from} to {@code last}, from 1, in order. */
	private static List<String> text(PDDocument document, int from, int last) throws IOException {
		PDFTextStripper stripper = new PDFTextStripper();
		stripper.setSortByPosition(true);
		List<String> pages = new ArrayList<>();
		for (int page = from; page <= last; page++) {
			stripper.setStartPage(page);
			stripper.setEndPage(page);
			pages.add(clean(stripper.getText(document)));
		}
		return pages;
	}

	private static BufferedImage drawn(PDDocument document, PDFRenderer renderer, int page) throws IOException {
		PDRectangle size = document.getPage(page - 1).getCropBox();
		// A scale of 1 is 72 DPI: the page's own points.
		float scale = Math.min(PICTURE_DPI / 72, MAX_PICTURE_SIDE / Math.max(size.getWidth(), size.getHeight()));
		return renderer.renderImage(page - 1, scale, ImageType.RGB);
	}

	/** The picture as JPEG at the best quality that fits the limit, or empty when none does. */
	private static byte[] fitted(BufferedImage image, int maxBytes) throws IOException {
		for (float quality : JPEG_QUALITIES) {
			byte[] jpeg = jpeg(image, quality);
			if (jpeg.length <= maxBytes) {
				return jpeg;
			}
		}
		return new byte[0];
	}

	private static byte[] jpeg(BufferedImage image, float quality) throws IOException {
		ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
		ByteArrayOutputStream jpeg = new ByteArrayOutputStream();
		try (ImageOutputStream out = ImageIO.createImageOutputStream(jpeg)) {
			ImageWriteParam param = writer.getDefaultWriteParam();
			param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
			param.setCompressionQuality(quality);
			writer.setOutput(out);
			writer.write(null, new IIOImage(image, null, null), param);
		}
		finally {
			writer.dispose();
		}
		return jpeg.toByteArray();
	}

}
