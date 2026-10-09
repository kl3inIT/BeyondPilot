package ai.genaifund.beyondpilot.proposal;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;

import org.junit.jupiter.api.Test;

class CsvRowsTest {

	@Test
	void aCellIsQuotedWhereItMustBeAndNeverRunsAsAFormula() {
		CsvRows rows = new CsvRows();
		rows.add(Arrays.asList("Pocket, Policy", "He said \"go\"", null, 3, "two\nlines"));
		rows.add(Arrays.asList("=1+1", "+84 912 345 678", "-2", "@sum", "+cmd|x", "plain"));

		assertThat(rows.toString()).isEqualTo("\"Pocket, Policy\",\"He said \"\"go\"\"\",,3,\"two\nlines\"\r\n"
				+ "'=1+1,+84 912 345 678,-2,'@sum,'+cmd|x,plain\r\n");
	}

}
