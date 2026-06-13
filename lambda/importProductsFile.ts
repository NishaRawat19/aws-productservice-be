import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Initialize S3 client
const s3Client = new S3Client({});

const BUCKET_NAME = process.env.BUCKET_NAME || "";
const SIGNED_URL_EXPIRATION = 300; // 5 minutes in seconds

/**
 * GET /import
 * Generates a signed URL for uploading a CSV file to S3
 * 
 * Query Parameters:
 * - name: The name of the CSV file to upload
 * 
 * Returns:
 * - Signed URL for uploading the file to S3
 */
const handler = async (event: any) => {
  try {
    console.log("Event:", JSON.stringify(event, null, 2));

    // Extract file name from query string parameters
    const fileName = event.queryStringParameters?.name;

    // Validate file name
    if (!fileName) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          message: "Missing required query parameter: name",
        }),
      };
    }

    // Validate file extension (only allow CSV files)
    if (!fileName.toLowerCase().endsWith(".csv")) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          message: "Invalid file type. Only CSV files are allowed.",
        }),
      };
    }

    // Create S3 key with uploaded/ prefix
    const s3Key = `uploaded/${fileName}`;

    console.log(`Generating signed URL for: ${s3Key} in bucket: ${BUCKET_NAME}`);

    // Create PutObject command
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      ContentType: "text/csv",
    });

    // Generate signed URL
    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: SIGNED_URL_EXPIRATION,
    });

    console.log(`Signed URL generated successfully for: ${s3Key}`);

    // Return signed URL
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        signedUrl: signedUrl,
        fileName: fileName,
        s3Key: s3Key,
        expiresIn: SIGNED_URL_EXPIRATION,
      }),
    };
  } catch (error) {
    console.error("Error generating signed URL:", error);
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
