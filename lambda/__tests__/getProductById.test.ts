import { handler } from "../getProductById";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";

const ddbMock = mockClient(DynamoDBDocumentClient);

describe("getProductById Lambda Function", () => {
  beforeEach(() => {
    ddbMock.reset();
    process.env.PRODUCTS_TABLE_NAME = "Products";
    process.env.STOCK_TABLE_NAME = "Stock";
  });

  afterEach(() => {
    delete process.env.PRODUCTS_TABLE_NAME;
    delete process.env.STOCK_TABLE_NAME;
  });

  test("should return product with stock information by ID", async () => {
    ddbMock
      .on(GetCommand, {
        TableName: "Products",
        Key: { id: "1" },
      })
      .resolves({
        Item: {
          id: "1",
          title: "Nike Air Max",
          description: "Premium shoes",
          price: 120,
        },
      })
      .on(GetCommand, {
        TableName: "Stock",
        Key: { product_id: "1" },
      })
      .resolves({
        Item: {
          product_id: "1",
          count: 45,
        },
      });

    const event = {
      pathParameters: { id: "1" },
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(result.headers["Content-Type"]).toBe("application/json");
    expect(result.headers["Access-Control-Allow-Origin"]).toBe("*");

    const body = JSON.parse(result.body);
    expect(body).toEqual({
      id: "1",
      title: "Nike Air Max",
      description: "Premium shoes",
      price: 120,
      count: 45,
    });
  });

  test("should return 400 when product ID is missing", async () => {
    const event = {
      pathParameters: null,
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toBe("Product ID is required");
  });

  test("should return 404 when product not found", async () => {
    ddbMock.on(GetCommand, {
      TableName: "Products",
      Key: { id: "999" },
    }).resolves({
      Item: undefined,
    });

    const event = {
      pathParameters: { id: "999" },
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.message).toBe("Product not found");
  });

  test("should return product with count 0 when no stock found", async () => {
    ddbMock
      .on(GetCommand, {
        TableName: "Products",
        Key: { id: "1" },
      })
      .resolves({
        Item: {
          id: "1",
          title: "Nike Air Max",
          description: "Premium shoes",
          price: 120,
        },
      })
      .on(GetCommand, {
        TableName: "Stock",
        Key: { product_id: "1" },
      })
      .resolves({
        Item: undefined,
      });

    const event = {
      pathParameters: { id: "1" },
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.count).toBe(0);
  });

  test("should handle DynamoDB errors gracefully", async () => {
    ddbMock.on(GetCommand).rejects(new Error("Database error"));

    const event = {
      pathParameters: { id: "1" },
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.message).toBe("Internal server error");
    expect(body.error).toBe("Database error");
  });

  test("should handle empty pathParameters object", async () => {
    const event = {
      pathParameters: {},
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toBe("Product ID is required");
  });

  test("should return correct CORS headers", async () => {
    const event = {
      pathParameters: null,
    };

    const result = await handler(event);

    expect(result.headers["Access-Control-Allow-Origin"]).toBe("*");
    expect(result.headers["Content-Type"]).toBe("application/json");
  });

  test("should handle special characters in product ID", async () => {
    const specialId = "test-id-123-abc";
    
    ddbMock
      .on(GetCommand, {
        TableName: "Products",
        Key: { id: specialId },
      })
      .resolves({
        Item: {
          id: specialId,
          title: "Special Product",
          price: 99,
        },
      })
      .on(GetCommand, {
        TableName: "Stock",
        Key: { product_id: specialId },
      })
      .resolves({
        Item: { product_id: specialId, count: 10 },
      });

    const event = {
      pathParameters: { id: specialId },
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.id).toBe(specialId);
  });
});
