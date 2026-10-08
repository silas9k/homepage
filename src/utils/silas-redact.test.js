import { describe, expect, it } from "vitest";

import { createSecretRedactor } from "./silas-redact";

describe("log secret redaction", () => {
  it("redacts literal, URL-encoded and file-backed secrets", () => {
    const redact = createSecretRedactor(
      {
        HOMEPAGE_VAR_API_TOKEN: 'secret!"',
        HOMEPAGE_FILE_PASSWORD: "/run/secrets/password",
        HOMEPAGE_VAR_URL: "https://example.com",
      },
      () => "file-secret\n",
    );
    expect(redact('secret!" secret!%22 file-secret https://example.com')).toBe(
      "[REDACTED] [REDACTED] [REDACTED] https://example.com",
    );
  });
  it("does not break logging when an optional secret file is missing", () => {
    expect(
      createSecretRedactor({ HOMEPAGE_FILE_PASSWORD: "/missing" }, () => {
        throw new Error();
      })("message"),
    ).toBe("message");
  });
});
