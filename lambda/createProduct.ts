import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { ProductDB } from "./types";

// Initialize DynamoDB client
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE_NAME || "Products";

interface CreateProductRequest {
  title: string;
  description?: string;
  price: number;
}

/**
 * POST /products
 * Creates a new product in the Products table
 */
const handler = async (event: any) => {
  try {
    // Parse request body
    let requestBody: CreateProductRequest;
    
    try {
      requestBody = JSON.parse(event.body || "{}");
    } catch (error) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          message: "Invalid JSON in request body",
        }),
      };
    }

    // Validate required fields
    if (!requestBody.title) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          message: "Missing required field: title",
        }),
      };
    }

    if (requestBody.price === undefined || requestBody.price === null) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          message: "Missing required field: price",
        }),
      };
    }

    // Validate price is a positive number
    if (typeof requestBody.price !== "number" || requestBody.price < 0) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          message: "Price must be a positive number",
        }),
      };
    }

    // Generate UUID for new product
    const productId = uuidv4();

    // Create product object
    const newProduct: ProductDB = {
      id: productId,
      title: requestBody.title.trim(),
      description: requestBody.description?.trim(),
      price: requestBody.price,
    };

    // Save to DynamoDB
    await docClient.send(
      new PutCommand({
        TableName: PRODUCTS_TABLE,
        Item: newProduct,
      })
    );

    // Return created product
    return {
      statusCode: 201,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        message: "Product created successfully",
        product: newProduct,
      }),
    };
  } catch (error) {
    console.error("Error creating product:", error);
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
