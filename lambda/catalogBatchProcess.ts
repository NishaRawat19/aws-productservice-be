import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { v4 as uuidv4 } from "uuid";
import type { SQSEvent, SQSRecord } from "aws-lambda";
import { ProductDB, StockDB } from "./types";

// Initialize AWS clients
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const snsClient = new SNSClient({});

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE_NAME || "Products";
const STOCK_TABLE = process.env.STOCK_TABLE_NAME || "Stock";
const TOPIC_ARN = process.env.CREATE_PRODUCT_TOPIC_ARN || "";

interface IncomingProduct {
  title?: string;
  description?: string;
  price?: number;
  count?: number;
  [key: string]: unknown;
}

async function processRecord(record: SQSRecord): Promise<void> {
  let data: IncomingProduct;

  try {
    data = JSON.parse(record.body || "{}") as IncomingProduct;
  } catch (error) {
    console.error("Invalid JSON in SQS record body", { body: record.body, error });
    return;
  }

  if (!data.title || typeof data.price !== "number") {
    console.warn("Missing required fields in SQS record - skipping", data);
    return;
  }

  const productId = uuidv4();

  const product: ProductDB = {
    id: productId,
    title: String(data.title).trim(),
    description: typeof data.description === "string" ? data.description.trim() : undefined,
    price: data.price,
  };

  const stock: StockDB = {
    product_id: productId,
    count: typeof data.count === "number" && data.count >= 0 ? data.count : 0,
  };

  // Write to DynamoDB tables
  await docClient.send(
    new PutCommand({
      TableName: PRODUCTS_TABLE,
      Item: product,
    })
  );

  await docClient.send(
    new PutCommand({
      TableName: STOCK_TABLE,
      Item: stock,
    })
  );

  // Publish notification to SNS topic (if configured)
  if (TOPIC_ARN) {
    try {
      await snsClient.send(
        new PublishCommand({
          TopicArn: TOPIC_ARN,
          Subject: "New product created",
          Message: JSON.stringify({ ...product, count: stock.count }),
          MessageAttributes: {
            price: {
              DataType: "Number",
              StringValue: String(product.price),
            },
          },
        })
      );
    } catch (error) {
      console.error("Failed to publish SNS notification for product", {
        productId,
        error,
      });
    }
  }
}

export const handler = async (event: SQSEvent): Promise<void> => {
  console.log("Received SQS event", {
    recordCount: event.Records.length,
  });

  const tasks = event.Records.map((record) =>
    processRecord(record).catch((error) => {
      console.error("Error processing SQS record", {
        messageId: record.messageId,
        error,
      });
    })
  );

  await Promise.all(tasks);
};
