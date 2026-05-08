import { handler } from "../getProductsList";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";

const ddbMock = mockClient(DynamoDBDocumentClient);

describe("getProductsList Lambda Function", () => {
  beforeEach(() => {
    ddbMock.reset();
    process.env.PRODUCTS_TABLE_NAME = "Products";
    process.env.STOCK_TABLE_NAME = "Stock";
  });

  afterEach(() => {
    delete process.env.PRODUCTS_TABLE_NAME;
    delete process.env.STOCK_TABLE_NAME;
  });

  test("should return all products with stock information", async () => {
    // Mock DynamoDB responses
    ddbMock
      .on(ScanCommand, { TableName: "Products" })
      .resolves({
        Items: [
          {
            id: "1",
            title: "Nike Air Max",
            description: "Premium shoes",
            price: 120,
          },
          {
            id: "2",
            title: "Adidas Ultraboost",
            description: "Running shoes",
            price: 180,
          },
        ],
      })
      .on(ScanCommand, { TableName: "Stock" })
      .resolves({
        Items: [
          { product_id: "1", count: 45 },
          { product_id: "2", count: 30 },
        ],
      });

    const event = {};
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(result.headers["Content-Type"]).toBe("application/json");
    expect(result.headers["Access-Control-Allow-Origin"]).toBe("*");

    const body = JSON.parse(result.body);
    expect(body).toHaveLength(2);
    expect(body[0]).toEqual({
      id: "1",
      title: "Nike Air Max",
      description: "Premium shoes",
      price: 120,
      count: 45,
    });
    expect(body[1]).toEqual({
      id: "2",
      title: "Adidas Ultraboost",
      description: "Running shoes",
      price: 180,
      count: 30,
    });
  });

  test("should return products with count 0 if no stock found", async () => {
    ddbMock
      .on(ScanCommand, { TableName: "Products" })
      .resolves({
        Items: [
          {
            id: "1",
            title: "Nike Air Max",
            description: "Premium shoes",
            price: 120,
          },
        ],
      })
      .on(ScanCommand, { TableName: "Stock" })
      .resolves({
        Items: [],
      });

    const event = {};
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body[0].count).toBe(0);
  });

  test("should return empty array when no products found", async () => {
    ddbMock
      .on(ScanCommand, { TableName: "Products" })
      .resolves({ Items: [] })
      .on(ScanCommand, { TableName: "Stock" })
      .resolves({ Items: [] });

    const event = {};
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toEqual([]);
  });

  test("should handle DynamoDB errors gracefully", async () => {
    ddbMock.on(ScanCommand).rejects(new Error("DynamoDB connection failed"));

    const event = {};
    const result = await handler(event);

    expect(result.statusCode).toBe(500);
    expect(result.headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(result.body);
    expect(body.message).toBe("Internal server error");
    expect(body.error).toBe("DynamoDB connection failed");
  });

  test("should handle CORS headers correctly", async () => {
    ddbMock
      .on(ScanCommand, { TableName: "Products" })
      .resolves({ Items: [] })
      .on(ScanCommand, { TableName: "Stock" })
      .resolves({ Items: [] });

    const event = {};
    const result = await handler(event);

    expect(result.headers["Access-Control-Allow-Origin"]).toBe("*");
    expect(result.headers["Content-Type"]).toBe("application/json");
  });

  test("should join products with multiple stock entries correctly", async () => {
    ddbMock
      .on(ScanCommand, { TableName: "Products" })
      .resolves({
        Items: [
          { id: "1", title: "Product 1", price: 100 },
          { id: "2", title: "Product 2", price: 200 },
          { id: "3", title: "Product 3", price: 300 },
        ],
      })
      .on(ScanCommand, { TableName: "Stock" })
      .resolves({
        Items: [
          { product_id: "1", count: 10 },
          { product_id: "3", count: 30 },
        ],
      });

    const event = {};
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toHaveLength(3);
    expect(body[0].count).toBe(10); // Product 1 has stock
    expect(body[1].count).toBe(0);  // Product 2 has no stock
    expect(body[2].count).toBe(30); // Product 3 has stock
  });
});
