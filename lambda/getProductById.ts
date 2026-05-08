import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { Product, ProductDB, StockDB } from "./types";

// Initialize DynamoDB client
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE_NAME || "Products";
const STOCK_TABLE = process.env.STOCK_TABLE_NAME || "Stock";

/**
 * GET /products/{productId}
 * Returns a single product with joined stock information
 */
const handler = async (event: any) => {
  try {
    const productId = event.pathParameters?.id;

    if (!productId) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ message: "Product ID is required" }),
      };
    }

    // Fetch product from Products table
    const productResponse = await docClient.send(
      new GetCommand({
        TableName: PRODUCTS_TABLE,
        Key: { id: productId },
      })
    );

    if (!productResponse.Item) {
      return {
        statusCode: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ message: "Product not found" }),
      };
    }

    const productData = productResponse.Item as ProductDB;

    // Fetch stock from Stock table
    const stockResponse = await docClient.send(
      new GetCommand({
        TableName: STOCK_TABLE,
        Key: { product_id: productId },
      })
    );

    const stockData = stockResponse.Item as StockDB | undefined;

    // Join product with stock data
    const joinedProduct: Product = {
      id: productData.id,
      title: productData.title,
      description: productData.description,
      price: productData.price,
      count: stockData?.count || 0, // Default to 0 if no stock found
    };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(joinedProduct),
    };
  } catch (error) {
    console.error("Error fetching product:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};

export { handler };
