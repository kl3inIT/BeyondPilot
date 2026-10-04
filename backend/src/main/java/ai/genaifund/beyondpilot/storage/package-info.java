/**
 * Uploaded files: the record of each file and the object store that holds its bytes. A module that owns a record with
 * a file names the file by its identifier and asks {@link ai.genaifund.beyondpilot.storage.StorageService} for it; it
 * never holds a path or an address of its own.
 */
@ApplicationModule(displayName = "Storage", type = ApplicationModule.Type.CLOSED, allowedDependencies = { "identity" })
@NullMarked
package ai.genaifund.beyondpilot.storage;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
