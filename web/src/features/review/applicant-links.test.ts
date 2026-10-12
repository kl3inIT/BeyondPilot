import { describe, expect, it } from "vitest";

import { linkedinAddress, mailAddress, phoneAddress, webAddress } from "./applicant-links";

describe("webAddress", () => {
  it("links an http or https address", () => {
    expect(webAddress("https://plaincover.example/demo")).toBe("https://plaincover.example/demo");
    expect(webAddress("http://plaincover.example")).toBe("http://plaincover.example/");
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "//evil.example/demo",
    "/admin",
    "plaincover.example",
    "",
  ])("leaves %j as text", (value) => {
    expect(webAddress(value)).toBeNull();
  });
});

describe("linkedinAddress", () => {
  it.each([
    "https://linkedin.com/in/weilingtan",
    "https://www.linkedin.com/in/weilingtan",
    "https://vn.linkedin.com/in/weilingtan",
    "https://WWW.LinkedIn.com/in/weilingtan",
  ])("links the profile %j", (value) => {
    expect(linkedinAddress(value)).toBe(new URL(value).href);
  });

  it.each([
    "http://www.linkedin.com/in/weilingtan",
    "https://linkedin.com.evil.example/in/weilingtan",
    "https://evil.example/linkedin.com/in/weilingtan",
    "https://notlinkedin.com/in/weilingtan",
    "https://linkedin.com@evil.example/",
    "https://someone@linkedin.com/in/weilingtan",
    "https://someone:secret@www.linkedin.com/in/weilingtan",
    "javascript:alert('linkedin.com')",
    "//www.linkedin.com/in/weilingtan",
    "www.linkedin.com/in/weilingtan",
    "weilingtan",
    "",
  ])("leaves %j as text", (value) => {
    expect(linkedinAddress(value)).toBeNull();
  });
});

describe("mailAddress", () => {
  it("writes to one plain mailbox", () => {
    expect(mailAddress("wei.ling@plaincover.example")).toBe("mailto:wei.ling@plaincover.example");
    expect(mailAddress("wei+tasco@plaincover.example")).toBe(
      "mailto:wei%2Btasco@plaincover.example",
    );
  });

  it.each([
    "wei@plaincover.example?subject=Invoice",
    "wei@plaincover.example?bcc=other@evil.example",
    "wei@plaincover.example&cc=other@evil.example",
    "wei@plaincover.example,other@evil.example",
    "wei@plaincover.example;other@evil.example",
    "wei@plaincover.example%0Abcc:other@evil.example",
    "wei@plaincover.example\nbcc:other@evil.example",
    "wei@plaincover.example other@evil.example",
    "wei@other@evil.example",
    "plaincover.example",
    "",
  ])("leaves %j as text", (value) => {
    expect(mailAddress(value)).toBeNull();
  });
});

describe("phoneAddress", () => {
  it("dials the digits with the leading plus", () => {
    expect(phoneAddress("+65 8123 4567")).toBe("tel:+6581234567");
    expect(phoneAddress("(028) 3822-1234")).toBe("tel:02838221234");
  });

  it.each(["call me", "65+8123", ""])("leaves %j as text", (value) => {
    expect(phoneAddress(value)).toBeNull();
  });
});
