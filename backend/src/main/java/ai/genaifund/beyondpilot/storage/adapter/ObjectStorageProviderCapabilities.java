package ai.genaifund.beyondpilot.storage.adapter;

/**
 * What an object store can do, as its adapter states it.
 * @param receivesThroughApplication whether the bytes of an upload arrive at this application, which then writes
 * them, instead of going straight to the store
 */
public record ObjectStorageProviderCapabilities(boolean receivesThroughApplication) {
}
