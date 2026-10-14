/**
 * Technical utilities that several modules need and that know nothing about any module: a list written as a
 * spreadsheet for operators to download (BEY-96), and a PDF read page by page as text and pictures. No Spring bean,
 * no persistence and no dependency on a module.
 */
@ApplicationModule(displayName = "Shared", type = ApplicationModule.Type.CLOSED, allowedDependencies = {})
@NullMarked
package ai.genaifund.beyondpilot.shared;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
