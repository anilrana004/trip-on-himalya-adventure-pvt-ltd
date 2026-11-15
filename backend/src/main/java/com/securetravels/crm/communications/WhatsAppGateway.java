package com.securetravels.crm.communications;

import java.util.List;

/**
 * The port every WhatsApp provider sits behind.
 *
 * <p>Implementations: {@link SandboxWhatsAppGateway} (default) and
 * {@link MetaWhatsAppGateway} (Meta Cloud API — company WABA, no BSP).
 *
 * <p>Gateways never throw for provider/transport faults — they return
 * {@link SendResult} so {@link WhatsAppDispatchService} owns retry policy.
 */
public interface WhatsAppGateway {

    /** Recorded on {@code whatsapp_messages.provider} and timeline rows. */
    String provider();

    SendResult send(SendCommand command);

    /**
     * @param phoneNumber national digits without country code (e.g. 10-digit IN)
     */
    record SendCommand(String countryCode,
                       String phoneNumber,
                       String templateName,
                       String languageCode,
                       List<String> bodyValues,
                       String callbackData) {
    }

    record SendResult(boolean success,
                      String providerMessageId,
                      String error,
                      String channelErrorCode,
                      String failureReason,
                      boolean retryable) {

        public static SendResult ok(String providerMessageId) {
            return new SendResult(true, providerMessageId, null, null, null, false);
        }

        public static SendResult failure(String error, String channelErrorCode,
                                         String failureReason, boolean retryable) {
            return new SendResult(false, null, error, channelErrorCode, failureReason, retryable);
        }
    }
}
