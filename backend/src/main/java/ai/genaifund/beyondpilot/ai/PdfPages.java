package ai.genaifund.beyondpilot.ai;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import javax.imageio.ImageIO;

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
				pages.add(stripper.getText(document).strip());
			}
			return pages;
		}
	}

	/** The pictures of these pages as PNG, by page number from 1; a page the file does not have is left out. */
	static Map<Integer, byte[]> pictures(InputStreamSource pdf, List<Integer> pages) throws IOException {
		try (InputStream content = pdf.getInputStream(); PDDocument document = Loader.loadPDF(content.readAllBytes())) {
			PDFRenderer renderer = new PDFRenderer(document);
			Map<Integer, byte[]> pictures = new LinkedHashMap<>();
			for (int page : pages) {
				if (page < 1 || page > document.getNumberOfPages()) {
					continue;
				}
				BufferedImage image = renderer.renderImageWithDPI(page - 1, PICTURE_DPI, ImageType.RGB);
				ByteArrayOutputStream png = new ByteArrayOutputStream();
				ImageIO.write(image, "png", png);
				pictures.put(page, png.toByteArray());
			}
			return pictures;
		}
	}

}
