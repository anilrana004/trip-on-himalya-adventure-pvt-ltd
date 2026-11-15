package com.securetravels.crm.automation.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.securetravels.crm.automation.runtime.RuntimeSnapshot;
import com.securetravels.crm.common.config.AppProperties;
import com.securetravels.crm.communications.TimelineEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class AiMessagingAgentTest {

    private AppProperties props;
    private AiMessagingAgent agent;

    @BeforeEach
    void setUp() {
        props = new AppProperties();
        props.getAi().setEnabled(true);
        props.getAi().setProvider(AppProperties.Ai.Provider.STUB);
        agent = new AiMessagingAgent(props, new ObjectMapper());
    }

    @Test
    void readyWhenStubEnabled() {
        assertThat(agent.ready()).isTrue();
        assertThat(agent.statusLabel()).contains("STUB");
    }

    @Test
    void sandboxChannelsAreWorkable() {
        assertThat(agent.channelWorkable(TimelineEvent.Channel.EMAIL)).isTrue();
        assertThat(agent.channelWorkable(TimelineEvent.Channel.WHATSAPP)).isTrue();
    }

    @Test
    void stubComposeFollowUp() {
        RuntimeSnapshot snap = new RuntimeSnapshot("lead", UUID.randomUUID(), Map.of(
                "customerName", "Anil",
                "destination", "Kedarkantha",
                "source", "WEBSITE",
                "status", "INTERESTED"));
        AiComposeResult result = agent.compose("FOLLOW_UP", TimelineEvent.Channel.EMAIL, snap, 2);
        assertThat(result.provider()).isEqualTo("STUB");
        assertThat(result.subject()).containsIgnoringCase("Kedarkantha");
        assertThat(result.body()).contains("Anil");
        assertThat(result.bodyValues()).containsExactly("Kedarkantha", "Anil");
    }

    @Test
    void disabledAgentNotReady() {
        props.getAi().setEnabled(false);
        assertThat(agent.ready()).isFalse();
    }
}
