package ai.genaifund.beyondpilot.ai;

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
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.core.io.InputStreamSource;

/** What PDFBox gives of a PDF: the text each page holds, and the picture of a page. No model is involved. */
final class PdfPages {

	/** Enough to read a slide's text, and about 1,200 tokens for a model that reads images. */
	private static final float PICTURE_DPI = 110;

	/** Tried in order until a page fits: a slide stays readable down to the last. */
	private static final float[] JPEG_QUALITIES = { 0.85f, 0.7f, 0.55f, 0.4f };

	private PdfPages() {
	}

	/** The text of each page, in order, up to a number of pages; an empty string for a page without text. */
	static List<String> text(InputStreamSource pdf, int maxPages) throws IOException {
		try (InputStream content = pdf.getInputStream(); PDDocument document = Loader.loadPDF(content.readAllBytes())) {
			PDFTextStripper stripper = new PDFTextStripper();
			stripper.setSortByPosition(true);
			int count = Math.min(document.getNumberOfPages(), maxPages);
			List<String> pages = new ArrayList<>(count);
			for (int page = 1; page <= count; page++) {
				stripper.setStartPage(page);
				stripper.setEndPage(page);
				pages.add(clean(stripper.getText(document)));
			}
			return pages;
		}
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

	/** The pictures of these pages as PNG, by page number from 1; a page the file does not have is left out. */
	static Map<Integer, byte[]> pictures(InputStreamSource pdf, List<Integer> pages) throws IOException {
		return drawn(pdf, pages, image -> {
			ByteArrayOutputStream png = new ByteArrayOutputStream();
			ImageIO.write(image, "png", png);
			return png.toByteArray();
		});
	}

	/**
	 * The pictures of these pages as JPEG no larger than a limit, for a service that takes no more: by page number
	 * from 1, a page the file does not have left out. A page that stays over the limit at the lowest quality is an
	 * empty array, so the caller knows it was drawn and cannot be sent.
	 */
	static Map<Integer, byte[]> jpegs(InputStreamSource pdf, List<Integer> pages, int maxBytes) throws IOException {
		return drawn(pdf, pages, image -> {
			for (float quality : JPEG_QUALITIES) {
				byte[] jpeg = jpeg(image, quality);
				if (jpeg.length <= maxBytes) {
					return jpeg;
				}
			}
			return new byte[0];
		});
	}

	private static Map<Integer, byte[]> drawn(InputStreamSource pdf, List<Integer> pages, Encoding encoding)
			throws IOException {
		try (InputStream content = pdf.getInputStream(); PDDocument document = Loader.loadPDF(content.readAllBytes())) {
			PDFRenderer renderer = new PDFRenderer(document);
			Map<Integer, byte[]> pictures = new LinkedHashMap<>();
			for (int page : pages) {
				if (page < 1 || page > document.getNumberOfPages()) {
					continue;
				}
				pictures.put(page, encoding.of(renderer.renderImageWithDPI(page - 1, PICTURE_DPI, ImageType.RGB)));
			}
			return pictures;
		}
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

	@FunctionalInterface
	private interface Encoding {

		byte[] of(BufferedImage image) throws IOException;

	}

}
