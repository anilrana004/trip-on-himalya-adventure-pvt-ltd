package com.securetravels.crm.communications.inbound;

import com.securetravels.crm.communications.thread.CommunicationChannel;
import com.securetravels.crm.communications.thread.CommunicationThread;
import com.securetravels.crm.lead.Lead;
import com.securetravels.crm.lead.LeadRepository;
import com.securetravels.crm.notification.NotificationWriter;
import com.securetravels.crm.user.Role;
import com.securetravels.crm.user.User;
import com.securetravels.crm.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Staff bell + inbox sound feed when a new inbound message is persisted.
 * Deduped by provider message id so webhook retries never double-notify.
 */
@Component
public class InboundStaffNotifier {

    private static final Logger log = LoggerFactory.getLogger(InboundStaffNotifier.class);

    private final NotificationWriter notifications;
    private final LeadRepository leads;
    private final UserRepository users;

    public InboundStaffNotifier(NotificationWriter notifications, LeadRepository leads,
                                UserRepository users) {
        this.notifications = notifications;
        this.leads = leads;
        this.users = users;
    }

    @Transactional
    public void notifyNewInbound(InboundMessage message, CommunicationThread thread) {
        if (message == null || message.getId() == null) return;
        String channel = message.getChannel() == null ? "MESSAGE" : message.getChannel().name();
        String preview = preview(message.getBody());
        String sender = senderLabel(message, thread);
        String title = "New " + humanChannel(message.getChannel()) + " message";
        String body = sender + ": " + preview;
        String link = thread != null && thread.getId() != null
                ? "/messages?thread=" + thread.getId()
                : "/messages";
        String dedupe = "inbound-msg:" + message.getId();

        Set<UUID> recipients = new HashSet<>();
        if (thread != null && thread.getAssignedTo() != null) {
            recipients.add(thread.getAssignedTo());
        }
        if (message.getLeadId() != null) {
            leads.findById(message.getLeadId()).map(Lead::getOwnerId).ifPresent(recipients::add);
        }
        if (recipients.isEmpty()) {
            List<User> managers = users.findByIsActiveTrueAndRoleIn(
                    EnumSet.of(Role.MANAGER, Role.ADMIN, Role.CEO, Role.SALES));
            // Prefer active sales + managers so unassigned inbox still lights up.
            for (User u : managers) {
                if (u.getRole() == Role.SALES || u.getRole() == Role.MANAGER
                        || u.getRole() == Role.ADMIN || u.getRole() == Role.CEO) {
                    recipients.add(u.getId());
                }
            }
        }

        int sent = 0;
        for (UUID userId : recipients) {
            if (notifications.saveOnce(userId, title, body, link, dedupe + ":" + userId)) {
                sent++;
            }
        }
        log.info("[inbound-notify] message={} channel={} recipients={} sent={}",
                message.getId(), channel, recipients.size(), sent);
    }

    private static String senderLabel(InboundMessage message, CommunicationThread thread) {
        if (thread != null && thread.getCustomerName() != null && !thread.getCustomerName().isBlank()) {
            return thread.getCustomerName().trim();
        }
        if (message.getFromMobile() != null) return message.getFromMobile();
        if (message.getFromEmail() != null) return message.getFromEmail();
        return "Customer";
    }

    private static String humanChannel(CommunicationChannel channel) {
        if (channel == null) return "inbox";
        return switch (channel) {
            case WHATSAPP -> "WhatsApp";
            case EMAIL -> "email";
            case SMS -> "SMS";
        };
    }

    private static String preview(String body) {
        if (body == null || body.isBlank()) return "(media or empty)";
        String flat = body.replaceAll("\\s+", " ").trim();
        return flat.length() <= 120 ? flat : flat.substring(0, 119) + "…";
    }
}
