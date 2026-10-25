package com.securetravels.crm.attendance;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

@Configuration
public class AttendanceConfig {

    @Bean
    Clock clock() {
        return Clock.system(AttendanceClock.ZONE);
    }
}
