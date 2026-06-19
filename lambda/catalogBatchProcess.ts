import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { v4 as uuidv4 } from "uuid";

// Minimal SQS batch event type to avoid external type dependencies
interface SQSBatchEvent {
  Records: Array<{
    messageId: string;
    body: string;
  }>;
}

// Initialize AWS SDK v3 clients
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const snsClient = new SNSClient({});

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE_NAME || "Products";
const STOCK_TABLE = process.env.STOCK_TABLE_NAME || "Stock";
const CREATE_PRODUCT_TOPIC_ARN = process.env.CREATE_PRODUCT_TOPIC_ARN;

interface CatalogProductMessage {
  title: string;
  description?: string;
  price: number;
  count?: number;
}

/**
 * Lambda Function: catalogBatchProcess
 *
 * Triggered by SQS events from the catalogItemsQueue.
 * Iterates over all SQS messages and creates corresponding
 * products in the Products table (and stock in the Stock table).
 */
export const handler = async (event: SQSBatchEvent): Promise<void> => {
  console.log("Received SQS event with records:", event.Records.length);

  for (const record of event.Records) {
    console.log("Processing record:", record.messageId);

    try {
      const body = JSON.parse(record.body) as CatalogProductMessage;

      if (body.price === undefined || body.price === null || !body.title) {
        console.warn("Skipping record with invalid product data:", record.body);
        continue;
      }

      const productId = uuidv4();

      const productItem = {
        id: productId,
        title: body.title,
        description: body.description,
        price: body.price,
      };

      const stockItem = {
        product_id: productId,
        count:
          typeof body.count === "number" && body.count >= 0 ? body.count : 0,
      };

      // Create product in Products table
      await docClient.send(
        new PutCommand({
          TableName: PRODUCTS_TABLE,
          Item: productItem,
        })
      );

      // Create stock entry in Stock table
      await docClient.send(
        new PutCommand({
          TableName: STOCK_TABLE,
          Item: stockItem,
        })
      );

      // Publish notification to SNS topic (if configured)
      if (CREATE_PRODUCT_TOPIC_ARN) {
        await snsClient.send(
          new PublishCommand({
            TopicArn: CREATE_PRODUCT_TOPIC_ARN,
            Subject: "New product created",
            Message: JSON.stringify({
              product: productItem,
              stock: stockItem,
            }),
          })
        );
      } else {
        console.warn("CREATE_PRODUCT_TOPIC_ARN is not set; skipping SNS publish");
      }

      console.log(`Created product ${productId} from record ${record.messageId}`);
    } catch (error) {
      console.error(
        `Failed to process record ${record.messageId}:`,
        error instanceof Error ? error.message : error
      );
      // Fail the whole batch so SQS can retry
      throw error;
    }
  }

  console.log("Successfully processed all SQS messages");
};
