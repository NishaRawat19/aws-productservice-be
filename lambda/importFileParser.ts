import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { S3Event } from "aws-lambda";
import csv from "csv-parser";
import { Readable } from "stream";

// Initialize S3 and SQS clients
const s3Client = new S3Client({});
const sqsClient = new SQSClient({});

interface ProductRecord {
  title?: string;
  description?: string;
  price?: string;
  count?: string;
  [key: string]: string | undefined;
}

/**
 * Lambda Function: importFileParser
 * Triggered by S3 ObjectCreated events in the uploaded/ folder
 *
 * Purpose:
 * - Reads CSV files from S3 using streams
 * - Parses CSV records using csv-parser
 * - Sends each record to SQS for batch processing
 *
 * @param event - S3 event containing information about uploaded object
 */
export const handler = async (event: S3Event): Promise<void> => {
  console.log("Event:", JSON.stringify(event, null, 2));

  const queueUrl = process.env.CATALOG_ITEMS_QUEUE_URL;

  if (!queueUrl) {
    throw new Error("CATALOG_ITEMS_QUEUE_URL environment variable is not set");
  }

  // Process each S3 record in the event
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    console.log(`Processing file: s3://${bucket}/${key}`);

    try {
      // Get object from S3
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await s3Client.send(command);

      if (!response.Body) {
        console.error("Empty response body from S3");
        continue;
      }

      // Convert the S3 response body to a Node.js readable stream
      const stream = response.Body as Readable;

      // Parse CSV and send records to SQS
      await new Promise<void>((resolve, reject) => {
        let recordCount = 0;
        let sentCount = 0;
        const sendPromises: Promise<any>[] = [];

        stream
          .pipe(csv())
          .on("data", async (data: ProductRecord) => {
            recordCount++;

            // Validate and send to SQS
            if (data.title && data.price) {
              const product = {
                title: data.title,
                description: data.description || "",
                price: parseFloat(data.price),
                count: data.count ? parseInt(data.count) : 0,
              };

              console.log(`Sending product to SQS: ${product.title}`);

              // Send message to SQS
              const sendPromise = sqsClient.send(
                new SendMessageCommand({
                  QueueUrl: queueUrl,
                  MessageBody: JSON.stringify(product),
                })
              ).then(() => {
                sentCount++;
                console.log(` Sent to SQS: ${product.title}`);
              }).catch((error) => {
                console.error(`Failed to send to SQS: ${product.title}`, error);
              });

              sendPromises.push(sendPromise);
            } else {
              console.warn(`Invalid product record ${recordCount} - skipping:`, data);
            }
          })
          .on("end", async () => {
            // Wait for all SQS messages to be sent
            await Promise.all(sendPromises);
            console.log(` Successfully processed ${recordCount} records from ${key}`);
            console.log(` Sent ${sentCount} messages to SQS`);
            resolve();
          })
          .on("error", (error) => {
            console.error(` Error parsing CSV from ${key}:`, error);
            reject(error);
          });
      });

    } catch (error) {
      console.error(`Error processing file ${key}:`, error);
      throw error;
    }
  }

  console.log("All records processed successfully");
};
