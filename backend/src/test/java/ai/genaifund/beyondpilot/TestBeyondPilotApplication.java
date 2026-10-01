package ai.genaifund.beyondpilot;

import org.springframework.boot.SpringApplication;

public class TestBeyondPilotApplication {

	public static void main(String[] args) {
		SpringApplication.from(BeyondPilotApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
