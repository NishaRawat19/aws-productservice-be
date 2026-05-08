import { handler } from "../createProduct";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";

const ddbMock = mockClient(DynamoDBDocumentClient);

// Mock uuid
jest.mock("uuid", () => ({
  v4: jest.fn(() => "mocked-uuid-1234"),
}));

describe("createProduct Lambda Function", () => {
  beforeEach(() => {
    ddbMock.reset();
    process.env.PRODUCTS_TABLE_NAME = "Products";
    process.env.STOCK_TABLE_NAME = "Stock";
  });

  afterEach(() => {
    delete process.env.PRODUCTS_TABLE_NAME;
    delete process.env.STOCK_TABLE_NAME;
  });

  test("should create a new product successfully", async () => {
    ddbMock.on(PutCommand).resolves({});

    const event = {
      body: JSON.stringify({
        title: "Nike Air Max",
        description: "Premium athletic shoes",
        price: 120,
        count: 45,
      }),
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(201);
    expect(result.headers["Content-Type"]).toBe("application/json");
    expect(result.headers["Access-Control-Allow-Origin"]).toBe("*");

    const body = JSON.parse(result.body);
    expect(body).toEqual({
      id: "mocked-uuid-1234",
      title: "Nike Air Max",
      description: "Premium athletic shoes",
      price: 120,
      count: 45,
    });
  });

  test("should return 400 when body is missing", async () => {
    const event = {
      body: null,
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toBe("Invalid request body");
  });

  test("should return 400 when title is missing", async () => {
    const event = {
      body: JSON.stringify({
        description: "Test description",
        price: 100,
        count: 10,
      }),
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toBe("Missing required fields: title, price");
  });

  test("should return 400 when price is missing", async () => {
    const event = {
      body: JSON.stringify({
        title: "Test Product",
        description: "Test description",
        count: 10,
      }),
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toBe("Missing required fields: title, price");
  });

  test("should return 400 when price is not a number", async () => {
    const event = {
      body: JSON.stringify({
        title: "Test Product",
        price: "not-a-number",
        count: 10,
      }),
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toBe("Price must be a positive number");
  });

  test("should return 400 when price is negative", async () => {
    const event = {
      body: JSON.stringify({
        title: "Test Product",
        price: -50,
        count: 10,
      }),
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toBe("Price must be a positive number");
  });

  test("should return 400 when count is not a number", async () => {
    const event = {
      body: JSON.stringify({
        title: "Test Product",
        price: 100,
        count: "invalid",
      }),
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toBe("Count must be a non-negative number");
  });

  test("should return 400 when count is negative", async () => {
    const event = {
      body: JSON.stringify({
        title: "Test Product",
        price: 100,
        count: -5,
      }),
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toBe("Count must be a non-negative number");
  });

  test("should default count to 0 when not provided", async () => {
    ddbMock.on(PutCommand).resolves({});

    const event = {
      body: JSON.stringify({
        title: "Test Product",
        price: 100,
      }),
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.count).toBe(0);
  });

  test("should handle DynamoDB errors gracefully", async () => {
    ddbMock.on(PutCommand).rejects(new Error("DynamoDB write failed"));

    const event = {
      body: JSON.stringify({
        title: "Test Product",
        price: 100,
        count: 10,
      }),
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.message).toBe("Failed to create product");
    expect(body.error).toBe("DynamoDB write failed");
  });

  test("should handle malformed JSON in body", async () => {
    const event = {
      body: "{ invalid json }",
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toBe("Invalid request body");
  });

  test("should create product with optional description", async () => {
    ddbMock.on(PutCommand).resolves({});

    const event = {
      body: JSON.stringify({
        title: "Minimal Product",
        price: 50,
      }),
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.title).toBe("Minimal Product");
    expect(body.price).toBe(50);
    expect(body.description).toBeUndefined();
  });
});
