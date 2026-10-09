package ai.genaifund.beyondpilot.identity.persistence;

import java.util.List;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** The hosts whose apps BeyondPilot has reviewed, and whether apps from other hosts may connect. */
@Repository
public class AppHostRepository {

	private final JdbcClient jdbc;

	AppHostRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	public boolean isReviewed(String host) {
		return jdbc.sql("select exists (select 1 from identity_app_host where host = :host)")
			.param("host", host)
			.query(Boolean.class)
			.single();
	}

	public boolean allowOtherHosts() {
		return jdbc.sql("select allow_other_hosts from identity_app_setting").query(Boolean.class).single();
	}

	public void allowOtherHosts(boolean allow) {
		jdbc.sql("update identity_app_setting set allow_other_hosts = :allow").param("allow", allow).update();
	}

	/** Every reviewed host, with the names of the apps from it that have signed in, in order of host. */
	public List<Host> hosts() {
		return jdbc.sql("""
				select h.host,
				       coalesce(array_agg(distinct c.client_name order by c.client_name)
				                filter (where c.client_name is not null), '{}') as apps
				from identity_app_host h
				left join oauth2_registered_client c on c.client_id like 'https://' || h.host || '/%'
				group by h.host
				order by h.host
				""")
			.query((row, number) -> new Host(row.getString("host"),
					List.of((String[]) row.getArray("apps").getArray())))
			.list();
	}

	/** @return whether it was added, rather than already there */
	public boolean add(String host) {
		return jdbc.sql("insert into identity_app_host (host) values (:host) on conflict do nothing")
			.param("host", host)
			.update() == 1;
	}

	/** @return whether it was there to remove */
	public boolean remove(String host) {
		return jdbc.sql("delete from identity_app_host where host = :host").param("host", host).update() == 1;
	}

	/** A reviewed host, and the apps from it that have signed in. */
	public record Host(String host, List<String> apps) {
	}

}
