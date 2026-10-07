package ai.genaifund.beyondpilot.notification.adapter;

/**
 * What a provider can do, as its adapter states it.
 * @param reportsDelivery whether the provider later reports delivery, bounces and complaints of what it was given
 */
public record EmailProviderCapabilities(boolean reportsDelivery) {
}
