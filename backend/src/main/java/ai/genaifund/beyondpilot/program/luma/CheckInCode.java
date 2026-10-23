package ai.genaifund.beyondpilot.program.luma;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;

import javax.imageio.ImageIO;

import io.nayuki.qrcodegen.QrCode;

/**
 * A guest's check-in address drawn as a QR code (BEY-245), which Luma's own confirmation email shows and the door
 * scans. Luma gives the address, not the image.
 */
public final class CheckInCode {

	/** Pixels per module, and the quiet zone around the code in modules, as scanners expect. */
	private static final int SCALE = 8;

	private static final int BORDER = 4;

	private CheckInCode() {
	}

	/** The code as a PNG, black on white. */
	public static byte[] png(String address) {
		QrCode code = QrCode.encodeText(address, QrCode.Ecc.MEDIUM);
		int size = (code.size + BORDER * 2) * SCALE;
		BufferedImage image = new BufferedImage(size, size, BufferedImage.TYPE_BYTE_BINARY);
		for (int y = 0; y < size; y++) {
			for (int x = 0; x < size; x++) {
				boolean dark = code.getModule(x / SCALE - BORDER, y / SCALE - BORDER);
				image.setRGB(x, y, dark ? 0x000000 : 0xFFFFFF);
			}
		}
		ByteArrayOutputStream out = new ByteArrayOutputStream();
		try {
			ImageIO.write(image, "png", out);
		}
		catch (IOException inMemory) {
			throw new UncheckedIOException(inMemory);
		}
		return out.toByteArray();
	}

}
