package com.securetravels.crm.automation.ai;

import com.securetravels.crm.automation.runtime.RuntimeSnapshot;
import com.securetravels.crm.common.config.AppProperties;
import com.securetravels.crm.communications.TimelineEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * In-house CRM messaging agent — no third-party LLM.
 *
 * <p>Composes guest copy from Trip On Himalaya rules and the subject snapshot,
 * then {@code ActionExecutor.AI_SEND_MESSAGE} sends via SendGate when the
 * channel is workable (email sandbox/SES, WhatsApp sandbox/Meta Cloud API).
 */
@Component
public class AiMessagingAgent {

    private static final Logger log = LoggerFactory.getLogger(AiMessagingAgent.class);

    private final AppProperties props;

    public AiMessagingAgent(AppProperties props) {
        this.props = props;
    }

    public boolean ready() {
        return props.getAi().ready();
    }

    public String statusLabel() {
        if (!props.getAi().isEnabled()) {
            return "Off — set AI_AGENT_ENABLED=true";
        }
        return "Ready · OWN (in-house rules, no third-party LLM)";
    }

    /**
     * Channel is workable when sandbox (always deliverable for testing) or live
     * credentials are present (SES / Meta WhatsApp Cloud API).
     */
    public boolean channelWorkable(TimelineEvent.Channel channel) {
        if (channel == null) {
            return false;
        }
        return switch (channel) {
            case EMAIL -> {
                var email = props.getEmail();
                if (email.getMode() == AppProperties.Email.Mode.SANDBOX) {
                    yield true;
                }
                yield email.live() && email.getAccessKey() != null && !email.getAccessKey().isBlank()
                        && email.getSecretKey() != null && !email.getSecretKey().isBlank();
            }
            case WHATSAPP -> {
                var wa = props.getWhatsApp();
                if (wa.getMode() == AppProperties.WhatsApp.Mode.SANDBOX) {
                    yield true;
                }
                yield wa.live() && wa.configured();
            }
            default -> false;
        };
    }

    public String channelNotWorkableReason(TimelineEvent.Channel channel) {
        if (channel == TimelineEvent.Channel.EMAIL) {
            return "Email channel not workable — use SANDBOX or configure SES credentials";
        }
        if (channel == TimelineEvent.Channel.WHATSAPP) {
            return "WhatsApp channel not workable — use SANDBOX or set META_WA_PHONE_NUMBER_ID + META_WA_ACCESS_TOKEN";
        }
        return "AI agent does not support channel " + channel;
    }

    public AiComposeResult compose(String intent, TimelineEvent.Channel channel,
                                   RuntimeSnapshot snapshot, int slotCount) {
        if (!ready()) {
            throw new IllegalStateException("AI messaging agent is not ready");
        }
        String intentKey = intent == null || intent.isBlank()
                ? "FOLLOW_UP" : intent.trim().toUpperCase(Locale.ROOT);
        Context ctx = Context.from(snapshot);
        AiComposeResult result = ownCompose(intentKey, channel, ctx, slotCount);
        log.info("[ai-agent] composed intent={} channel={} provider=OWN", intentKey, channel);
        return result;
    }

    private AiComposeResult ownCompose(String intent, TimelineEvent.Channel channel,
                                       Context ctx, int slotCount) {
        String trek = ctx.trek();
        String name = ctx.name();
        boolean hotSource = ctx.isFastTrackSource();

        String subject = switch (intent) {
            case "QUOTATION_CHASE" -> "Quick check-in on your " + trek + " quote";
            case "BOOKING_NUDGE" -> "Ready to lock your " + trek + " dates?";
            default -> hotSource
                    ? "Next steps for your " + trek + " enquiry"
                    : "Following up on your " + trek + " enquiry";
        };

        String body = switch (intent) {
            case "QUOTATION_CHASE" ->
                    "Hi " + name + ",\n\n"
                            + "This is Trip On Himalaya following up on the " + trek
                            + " quotation we shared. If dates, group size, or inclusions need a tweak, "
                            + "reply to this message and we will revise it.\n\n"
                            + "If you are ready to confirm, we can hold a place and share the payment steps.\n\n"
                            + "Trip On Himalaya";
            case "BOOKING_NUDGE" ->
                    "Hi " + name + ",\n\n"
                            + "Seats for " + trek + " fill up closer to departure. "
                            + "If you want to lock your dates, reply with your preferred window and traveller count "
                            + "and we will guide you through confirmation.\n\n"
                            + "Trip On Himalaya";
            default ->
                    "Hi " + name + ",\n\n"
                            + "Thank you for your interest in " + trek + " with Trip On Himalaya. "
                            + (hotSource
                            ? "Because you came in through ads/web, we are prioritising a quick first reply. "
                            : "")
                            + "Tell us your preferred month, group size, and fitness level and we will suggest "
                            + "the right departure and inclusions.\n\n"
                            + "Trip On Himalaya";
        };

        List<String> slots = fillSlots(slotCount, trek, name);
        if (channel == TimelineEvent.Channel.WHATSAPP) {
            return new AiComposeResult(null, body, slots, "OWN");
        }
        return new AiComposeResult(subject, body, slots, "OWN");
    }

    private static List<String> fillSlots(int slotCount, String trek, String name) {
        if (slotCount <= 0) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        out.add(trek);
        if (slotCount >= 2) {
            out.add(name);
        }
        while (out.size() < slotCount) {
            out.add("");
        }
        return out;
    }

    private record Context(String name, String trek, String source, String status) {
        static Context from(RuntimeSnapshot snapshot) {
            String name = firstNonBlank(
                    snapshot.asString("customerName"),
                    snapshot.asString("fullName"),
                    "there");
            String trek = firstNonBlank(
                    snapshot.asString("destination"),
                    snapshot.asString("packageName"),
                    "your Himalayan trek");
            String source = firstNonBlank(snapshot.asString("source"), "OTHER");
            String status = firstNonBlank(snapshot.asString("status"), "NEW");
            return new Context(name, trek, source, status);
        }

        boolean isFastTrackSource() {
            return "FACEBOOK_ADS".equals(source)
                    || "INSTAGRAM".equals(source)
                    || "GOOGLE_ADS".equals(source)
                    || "WEBSITE".equals(source)
                    || "STOREFRONT".equals(source);
        }

        private static String firstNonBlank(String... values) {
            for (String v : values) {
                if (v != null && !v.isBlank()) {
                    return v.trim();
                }
            }
            return "";
        }
    }
}
