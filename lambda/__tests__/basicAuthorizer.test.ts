import { handler } from "../basicAuthorizer";

const methodArn = "arn:aws:execute-api:us-east-1:123456789012:apiId/prod/GET/import";

describe("basicAuthorizer Lambda", () => {
  beforeEach(() => {
    process.env.CREDENTIALS = "nisharawat.19@gmail.com=TEST_PASSWORD";
  });

  afterEach(() => {
    delete process.env.CREDENTIALS;
  });

  test("allows access for valid Basic credentials", async () => {
    const token = Buffer.from("nisharawat.19@gmail.com:TEST_PASSWORD").toString("base64");

    const event = {
      type: "TOKEN",
      authorizationToken: `Basic ${token}`,
      methodArn,
    };

    const result = await handler(event);

    expect(result.policyDocument.Statement[0].Effect).toBe("Allow");
    expect(result.principalId).toBe("nisharawat.19@gmail.com");
    expect(result.context?.isAuthorized).toBe("true");
  });

  test("denies access for invalid password (403)", async () => {
    const token = Buffer.from("nisharawat.19@gmail.com:WRONG").toString("base64");

    const event = {
      type: "TOKEN",
      authorizationToken: `Basic ${token}`,
      methodArn,
    };

    const result = await handler(event);

    expect(result.policyDocument.Statement[0].Effect).toBe("Deny");
    expect(result.principalId).toBe("nisharawat.19@gmail.com");
    expect(result.context?.isAuthorized).toBe("false");
  });

  test("returns Deny policy for malformed token (no Basic scheme)", async () => {
    const token = Buffer.from("nisharawat.19@gmail.com:TEST_PASSWORD").toString("base64");

    const event = {
      type: "TOKEN",
      authorizationToken: token, // missing 'Basic '
      methodArn,
    };

    const result = await handler(event);

    expect(result.policyDocument.Statement[0].Effect).toBe("Deny");
    expect(result.principalId).toBe("anonymous");
  });

  test("throws Unauthorized error when Authorization header is missing (401)", async () => {
    const event = {
      type: "TOKEN",
      // no authorizationToken
      methodArn,
    };

    await expect(handler(event)).rejects.toThrow("Unauthorized");
  });
});
