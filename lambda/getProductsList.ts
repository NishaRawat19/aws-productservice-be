import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { Product, ProductDB, StockDB } from "./types";

// Initialize DynamoDB client
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE_NAME || "Products";
const STOCK_TABLE = process.env.STOCK_TABLE_NAME || "Stock";

/**
 * GET /products
 * Returns all products with joined stock information
 */
const handler = async () => {
  try {
    // Fetch all products from Products table
    const productsResponse = await docClient.send(
      new ScanCommand({
        TableName: PRODUCTS_TABLE,
      })
    );

    // Fetch all stock from Stock table
    const stockResponse = await docClient.send(
      new ScanCommand({
        TableName: STOCK_TABLE,
      })
    );

    const productsData = (productsResponse.Items || []) as ProductDB[];
    const stockData = (stockResponse.Items || []) as StockDB[];

    // Create a map of stock by product_id for quick lookup
    const stockMap = new Map<string, number>();
    stockData.forEach((stock) => {
      stockMap.set(stock.product_id, stock.count);
    });

    // Join products with stock data
    const joinedProducts: Product[] = productsData.map((product) => ({
      id: product.id,
      title: product.title,
      description: product.description,
      price: product.price,
      count: stockMap.get(product.id) || 0, // Default to 0 if no stock found
    }));

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(joinedProducts),
    };
  } catch (error) {
    console.error("Error fetching products:", error);
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
