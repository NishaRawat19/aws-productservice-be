const CREDENTIALS_ENV = process.env.CREDENTIALS || "";

interface AuthPolicy {
  principalId: string;
  policyDocument: {
    Version: string;
    Statement: Array<{
      Action: string | string[];
      Effect: "Allow" | "Deny";
      Resource: string | string[];
    }>;
  };
  context?: Record<string, string | number | boolean>;
}

function parseCredentials(envValue: string): Record<string, string> {
  const map: Record<string, string> = {};
  if (!envValue) return map;

  // Support single or multiple credentials, separated by commas or semicolons
  const pairs = envValue.split(/[;,]/).map((p) => p.trim()).filter(Boolean);

  for (const pair of pairs) {
    const [username, password] = pair.split("=");
    if (username && password) {
      map[username.trim()] = password.trim();
    }
  }

  return map;
}

function generatePolicy(
  principalId: string,
  effect: "Allow" | "Deny",
  resource: string
): AuthPolicy {
  return {
    principalId,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: effect,
          Resource: resource,
        },
      ],
    },
    context: {
      user: principalId,
      isAuthorized: effect === "Allow" ? "true" : "false",
    },
  };
}

export const handler = async (event: any): Promise<AuthPolicy> => {
	const token: string | undefined = event?.authorizationToken;
	const methodArn: string = event?.methodArn ?? "*";

	// No Authorization header/token -> 401 (API Gateway returns 401 when
	// the authorizer throws an "Unauthorized" error)
	if (!token || typeof token !== "string" || token.trim() === "") {
	  throw new Error("Unauthorized");
	}

	const [scheme, encoded] = token.split(" ");

	// Token is present but not a valid Basic token -> 403 (Deny policy)
	if (!scheme || !encoded || scheme.toLowerCase() !== "basic") {
	  return generatePolicy("anonymous", "Deny", methodArn);
	}

	let decoded: string;
	try {
	  decoded = Buffer.from(encoded, "base64").toString("utf-8");
	} catch {
	  // Malformed base64 token -> treat as invalid credentials (403)
	  return generatePolicy("anonymous", "Deny", methodArn);
	}

	const separatorIndex = decoded.indexOf(":");
	if (separatorIndex === -1) {
	  // Missing username:password separator -> invalid credentials (403)
	  return generatePolicy("anonymous", "Deny", methodArn);
	}

	const username = decoded.slice(0, separatorIndex);
	const password = decoded.slice(separatorIndex + 1);

	const credentials = parseCredentials(CREDENTIALS_ENV);
	const expectedPassword = credentials[username];

	const isValid =
	  typeof expectedPassword === "string" && expectedPassword === password;

	if (!isValid) {
	  // User is known/attempted but credentials don't match -> 403 (Deny)
	  return generatePolicy(username || "anonymous", "Deny", methodArn);
	}

	// Valid credentials -> 200 for the underlying method (Allow policy)
	return generatePolicy(username || "anonymous", "Allow", methodArn);
};
