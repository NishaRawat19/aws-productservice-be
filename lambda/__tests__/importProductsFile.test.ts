import { handler } from "../importProductsFile";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mockClient } from "aws-sdk-client-mock";

// Mock getSignedUrl
jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn(),
}));

const s3Mock = mockClient(S3Client);

describe("importProductsFile Lambda Function", () => {
  beforeEach(() => {
    s3Mock.reset();
    process.env.BUCKET_NAME = "test-bucket";
    (getSignedUrl as jest.Mock).mockResolvedValue(
      "https://test-bucket.s3.amazonaws.com/uploaded/test.csv?signed-params"
    );
  });

  afterEach(() => {
    delete process.env.BUCKET_NAME;
    jest.clearAllMocks();
  });

  test("should generate signed URL for valid CSV file", async () => {
    const event = {
      queryStringParameters: {
        name: "products.csv",
      },
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(result.headers["Content-Type"]).toBe("application/json");
    expect(result.headers["Access-Control-Allow-Origin"]).toBe("*");

    const body = JSON.parse(result.body);
    expect(body.signedUrl).toBe(
      "https://test-bucket.s3.amazonaws.com/uploaded/test.csv?signed-params"
    );
    expect(body.fileName).toBe("products.csv");
    expect(body.s3Key).toBe("uploaded/products.csv");
    expect(body.expiresIn).toBe(300);

    expect(getSignedUrl).toHaveBeenCalledTimes(1);
  });

  test("should return 400 when file name is missing", async () => {
    const event = {
      queryStringParameters: null,
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toBe("Missing required query parameter: name");
  });

  test("should return 400 when query parameters are empty", async () => {
    const event = {
      queryStringParameters: {},
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toBe("Missing required query parameter: name");
  });

  test("should return 400 for non-CSV files", async () => {
    const event = {
      queryStringParameters: {
        name: "products.txt",
      },
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toBe("Invalid file type. Only CSV files are allowed.");
  });

  test("should return 400 for .xlsx files", async () => {
    const event = {
      queryStringParameters: {
        name: "products.xlsx",
      },
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toBe("Invalid file type. Only CSV files are allowed.");
  });

  test("should handle uppercase CSV extension", async () => {
    const event = {
      queryStringParameters: {
        name: "PRODUCTS.CSV",
      },
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.fileName).toBe("PRODUCTS.CSV");
    expect(body.s3Key).toBe("uploaded/PRODUCTS.CSV");
  });

  test("should handle mixed case CSV extension", async () => {
    const event = {
      queryStringParameters: {
        name: "products.CsV",
      },
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.fileName).toBe("products.CsV");
  });

  test("should create correct S3 key with uploaded prefix", async () => {
    const event = {
      queryStringParameters: {
        name: "inventory-2024.csv",
      },
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.s3Key).toBe("uploaded/inventory-2024.csv");
  });

  test("should handle special characters in file name", async () => {
    const event = {
      queryStringParameters: {
        name: "products-2024_v1.csv",
      },
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.fileName).toBe("products-2024_v1.csv");
    expect(body.s3Key).toBe("uploaded/products-2024_v1.csv");
  });

  test("should handle S3 client errors gracefully", async () => {
    (getSignedUrl as jest.Mock).mockRejectedValue(
      new Error("S3 service unavailable")
    );

    const event = {
      queryStringParameters: {
        name: "products.csv",
      },
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.message).toBe("Internal server error");
    expect(body.error).toBe("S3 service unavailable");
  });

  test("should use correct bucket name from environment", async () => {
    process.env.BUCKET_NAME = "custom-bucket-name";

    const event = {
      queryStringParameters: {
        name: "test.csv",
      },
    };

    await handler(event);

    expect(getSignedUrl).toHaveBeenCalled();
    // Verify the command passed to getSignedUrl has the correct bucket
    const call = (getSignedUrl as jest.Mock).mock.calls[0];
    const command = call[1] as PutObjectCommand;
    expect(command.input.Bucket).toBe("custom-bucket-name");
  });

  test("should set ContentType to text/csv", async () => {
    const event = {
      queryStringParameters: {
        name: "test.csv",
      },
    };

    await handler(event);

    const call = (getSignedUrl as jest.Mock).mock.calls[0];
    const command = call[1] as PutObjectCommand;
    expect(command.input.ContentType).toBe("text/csv");
  });

  test("should return CORS headers in all responses", async () => {
    const event = {
      queryStringParameters: null,
    };

    const result = await handler(event);

    expect(result.headers["Access-Control-Allow-Origin"]).toBe("*");
    expect(result.headers["Content-Type"]).toBe("application/json");
  });
});
