package ai.genaifund.beyondpilot.usecase;

import jakarta.validation.constraints.Positive;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * @param vndPerUsd how many đồng make a US dollar when the public list orders budgets in both currencies; no reader
 * sees the converted amount, so an approximate rate is enough
 */
@Validated
@ConfigurationProperties("beyondpilot.usecase")
public record UseCaseProperties(@DefaultValue("26000") @Positive long vndPerUsd) {
}
