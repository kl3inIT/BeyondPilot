package ai.genaifund.beyondpilot.organization;

import java.net.URI;
import java.net.URISyntaxException;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.organization.dto.DeclinedRequestResponse;
import ai.genaifund.beyondpilot.organization.dto.InvitationResponse;
import ai.genaifund.beyondpilot.organization.dto.JoinRequestResponse;
import ai.genaifund.beyondpilot.organization.dto.MemberResponse;
import ai.genaifund.beyondpilot.organization.dto.OrganizationResponse;
import ai.genaifund.beyondpilot.organization.persistence.MembershipRepository.ClosedRequest;
import ai.genaifund.beyondpilot.organization.persistence.MembershipRepository.Invitation;
import ai.genaifund.beyondpilot.organization.persistence.MembershipRepository.JoinRequest;
import ai.genaifund.beyondpilot.organization.persistence.MembershipRepository.Member;
import ai.genaifund.beyondpilot.organization.persistence.Organization;
import org.jspecify.annotations.Nullable;

/** What both application services of the module derive the same way: the response records, a slug, a work domain. */
final class OrganizationViews {

	/** Mail services anyone can get an address on. An address there says nothing about where its owner works. */
	private static final Set<String> PUBLIC_MAIL_DOMAINS = Set.of("gmail.com", "googlemail.com", "yahoo.com",
			"yahoo.com.vn", "ymail.com", "outlook.com", "outlook.com.vn", "hotmail.com", "live.com", "msn.com",
			"icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com", "pm.me", "gmx.com", "gmx.net",
			"mail.com", "yandex.com", "yandex.ru", "zoho.com", "qq.com", "163.com", "126.com", "naver.com",
			"fastmail.com", "hey.com", "tutanota.com", "tuta.io");

	private static final int MAX_SLUG_LENGTH = 60;

	private static final String WWW = "www.";

	private OrganizationViews() {
	}

	static OrganizationResponse organization(Organization organization) {
		return new OrganizationResponse(organization.getId(), organization.getSlug(), organization.getName(),
				organization.getType(), organization.getWebsite(), organization.getCountry(),
				organization.getTeamSize(), organization.getIndustries(), organization.getDescription(),
				organization.getFoundedYear(), organization.getLogoFileId(),
				organization.getEmailDomain(),
				organization.isAutoJoin(), organization.getStatus(), organization.getDecisionReason(),
				organization.getDecisionMessage(), organization.getSuspensionReason(),
				organization.getSuspensionMessage(), organization.getSuspendedAt(), organization.getVersion(),
				organization.getCreatedAt());
	}

	static List<MemberResponse> members(List<Member> members, Map<UUID, Person> people, @Nullable UUID caller) {
		return members.stream().filter(member -> people.containsKey(member.accountId())).map(member -> {
			Person person = people.get(member.accountId());
			return new MemberResponse(member.accountId(), person.displayName(), person.email(), member.role(),
					member.jobTitle(), member.joinedAt(), member.accountId().equals(caller));
		}).toList();
	}

	static InvitationResponse invitation(Invitation invitation, String organizationName, Map<UUID, Person> people) {
		Person inviter = people.get(invitation.invitedByAccountId());
		return new InvitationResponse(invitation.id(), invitation.organizationId(), organizationName,
				invitation.email(), invitation.role(), inviter == null ? "GenAI Fund" : inviter.label(),
				invitation.createdAt());
	}

	static JoinRequestResponse joinRequest(JoinRequest request, Organization organization, Person person) {
		return new JoinRequestResponse(request.id(), request.organizationId(), organization.getName(),
				organization.getType(), organization.getCountry(), organization.getEmailDomain(), person.displayName(),
				person.email(), request.message(), request.claim(), request.createdAt());
	}

	static DeclinedRequestResponse declined(ClosedRequest request, Organization organization) {
		return new DeclinedRequestResponse(organization.getId(), organization.getName(), organization.getType(),
				organization.getCountry(), organization.getEmailDomain(), request.claim(), request.decidedAt());
	}

	/** The accounts a list of invitations and requests names, to look their people up at once. */
	static List<UUID> accounts(List<Invitation> invitations, List<JoinRequest> requests) {
		return Stream.concat(invitations.stream().map(Invitation::invitedByAccountId),
				requests.stream().map(JoinRequest::accountId))
			.distinct()
			.toList();
	}

	/** The codes a person chose, each once, in the order chosen. */
	static List<String> codes(List<String> codes) {
		return codes.stream().distinct().toList();
	}

	/** What a person typed, or null when they typed nothing. */
	static @Nullable String text(@Nullable String value) {
		return value == null || value.isBlank() ? null : value.strip();
	}

	/**
	 * The domain of a work address, in lowercase; null for an address on a public mail service, which says nothing
	 * about an organization.
	 */
	static @Nullable String workDomain(String email) {
		int at = email.lastIndexOf('@');
		if (at < 0 || at == email.length() - 1) {
			return null;
		}
		String domain = email.substring(at + 1).toLowerCase(Locale.ROOT);
		return PUBLIC_MAIL_DOMAINS.contains(domain) ? null : domain;
	}

	/** The domain a website is served from, in lowercase and without {@code www.}; null when it names none. */
	static @Nullable String websiteDomain(@Nullable String website) {
		if (website == null) {
			return null;
		}
		try {
			String host = new URI(website).getHost();
			if (host == null) {
				return null;
			}
			String domain = host.toLowerCase(Locale.ROOT);
			return domain.startsWith(WWW) ? domain.substring(WWW.length()) : domain;
		}
		catch (URISyntaxException exception) {
			return null;
		}
	}

	/** An address for the name: its letters and digits in lowercase, joined by hyphens. */
	static String slug(String name) {
		String ascii = Normalizer.normalize(name, Normalizer.Form.NFD)
			.replaceAll("\\p{M}", "")
			.replace('đ', 'd')
			.replace('Đ', 'D')
			.toLowerCase(Locale.ROOT)
			.replaceAll("[^a-z0-9]+", "-")
			.replaceAll("(^-+)|(-+$)", "");
		if (ascii.isEmpty()) {
			return "organization";
		}
		return ascii.length() > MAX_SLUG_LENGTH ? ascii.substring(0, MAX_SLUG_LENGTH).replaceAll("-+$", "") : ascii;
	}
}
