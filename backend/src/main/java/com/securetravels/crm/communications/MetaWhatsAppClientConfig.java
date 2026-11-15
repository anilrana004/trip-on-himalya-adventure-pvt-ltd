package com.securetravels.crm.communications;

import com.securetravels.crm.common.config.AppProperties;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/**
 * HTTP client for Meta WhatsApp Cloud API (live mode only).
 */
@Configuration
@ConditionalOnProperty(prefix = "app.whatsapp", name = "mode", havingValue = "META")
public class MetaWhatsAppClientConfig {

    @Bean
    public RestClient metaWhatsAppRestClient(RestClient.Builder builder, AppProperties props) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(props.getWhatsApp().getConnectTimeout());
        factory.setReadTimeout(props.getWhatsApp().getReadTimeout());
        return builder.requestFactory(factory).build();
    }
}
