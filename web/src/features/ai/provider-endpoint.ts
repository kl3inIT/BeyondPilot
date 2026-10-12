/** The longest address the backend takes. */
const MAX_LENGTH = 2048;

/** The metadata service of an AWS host over IPv6, which is not in the link-local range. */
const AWS_METADATA_V6 = "fd00:ec2::254";

/** Whether a host written as an address is link-local, where cloud hosts keep their metadata service. */
function linkLocal(hostname: string) {
  if (hostname.startsWith("[")) {
    const address = hostname.slice(1, -1).toLowerCase();
    // fe80::/10: the first group runs from fe80 to febf.
    return /^fe[89ab][0-9a-f]:/.test(address) || address === AWS_METADATA_V6;
  }
  return hostname.startsWith("169.254.");
}

/**
 * Whether an address has the shape a provider's address may have, as the backend decides it
 * (`ChatEndpoints.valid`): `http` or `https` with a host, private hosts included, and no credentials,
 * query or fragment, where a secret could hide, and no link-local host. It is asked when the field is
 * left so the reader hears of a slip before saving; the backend's answer stays the one that counts
 * (`AI_PROVIDER_ENDPOINT_INVALID`).
 */
function validEndpoint(url: string): boolean {
  if (url === "" || url.length > MAX_LENGTH || url !== url.trim() || /\s/.test(url)) {
    return false;
  }
  if (!/^https?:\/\//i.test(url) || url.includes("?") || url.includes("#")) {
    return false;
  }
  // Credentials stand before an @ in the part that names the host.
  const authority = url.replace(/^https?:\/\//i, "").split("/")[0];
  if (authority.includes("@")) {
    return false;
  }
  try {
    const { hostname } = new URL(url);
    return hostname !== "" && !linkLocal(hostname);
  } catch {
    return false;
  }
}

export { validEndpoint };
