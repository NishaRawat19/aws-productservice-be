import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { S3Event } from "aws-lambda";
import csv from "csv-parser";
import { Readable } from "stream";

// Initialize S3 client
const s3Client = new S3Client({});

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
 * - Logs each record to CloudWatch
 * 
 * @param event - S3 event containing information about uploaded object
 */
export const handler = async (event: S3Event): Promise<void> => {
  console.log("Event:", JSON.stringify(event, null, 2));

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

      // Parse CSV and process records
      await new Promise<void>((resolve, reject) => {
        let recordCount = 0;

        stream
          .pipe(csv())
          .on("data", (data: ProductRecord) => {
            recordCount++;
            
            // Log each record to CloudWatch
            console.log(`Record ${recordCount}:`, JSON.stringify(data, null, 2));
            
            // Additional validation/transformation can be added here
            if (data.title && data.price) {
              console.log(`Valid product: ${data.title} - $${data.price}`);
            } else {
              console.warn(`Invalid product record ${recordCount}:`, data);
            }
          })
          .on("end", () => {
            console.log(`✅ Successfully processed ${recordCount} records from ${key}`);
            resolve();
          })
          .on("error", (error) => {
            console.error(`❌ Error parsing CSV from ${key}:`, error);
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
