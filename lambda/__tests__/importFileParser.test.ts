import { handler } from "../importFileParser";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import { Readable } from "stream";
import { S3Event } from "aws-lambda";

const s3Mock = mockClient(S3Client);

// Helper function to create a readable stream from string
function createReadableStream(data: string): Readable {
  const stream = new Readable();
  stream.push(data);
  stream.push(null);
  return stream;
}

describe("importFileParser Lambda Function", () => {
  beforeEach(() => {
    s3Mock.reset();
    process.env.BUCKET_NAME = "test-bucket";
  });

  afterEach(() => {
    delete process.env.BUCKET_NAME;
  });

  test("should parse CSV file successfully", async () => {
    const csvData = `title,description,price,count
Nike Air Max,Premium shoes,120,45
Adidas Ultraboost,Running shoes,180,30`;

    const stream = createReadableStream(csvData);

    s3Mock.on(GetObjectCommand).resolves({
      Body: stream as any,
    });

    const event: S3Event = {
      Records: [
        {
          eventVersion: "2.1",
          eventSource: "aws:s3",
          awsRegion: "us-east-1",
          eventTime: "2024-01-01T00:00:00.000Z",
          eventName: "ObjectCreated:Put",
          userIdentity: {
            principalId: "TEST",
          },
          requestParameters: {
            sourceIPAddress: "127.0.0.1",
          },
          responseElements: {
            "x-amz-request-id": "TEST",
            "x-amz-id-2": "TEST",
          },
          s3: {
            s3SchemaVersion: "1.0",
            configurationId: "testConfigRule",
            bucket: {
              name: "test-bucket",
              ownerIdentity: {
                principalId: "TEST",
              },
              arn: "arn:aws:s3:::test-bucket",
            },
            object: {
              key: "uploaded/test.csv",
              size: 100,
              eTag: "test-etag",
              sequencer: "test-sequencer",
            },
          },
        },
      ],
    };

    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

    await handler(event);

    expect(s3Mock.calls()).toHaveLength(1);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Processing file: s3://test-bucket/uploaded/test.csv")
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Successfully processed 2 records")
    );

    consoleLogSpy.mockRestore();
  });

  test("should handle file with URL encoded key", async () => {
    const csvData = `title,price
Test Product,99`;

    s3Mock.on(GetObjectCommand).resolves({
      Body: createReadableStream(csvData) as any,
    });

    const event: S3Event = {
      Records: [
        {
          eventVersion: "2.1",
          eventSource: "aws:s3",
          awsRegion: "us-east-1",
          eventTime: "2024-01-01T00:00:00.000Z",
          eventName: "ObjectCreated:Put",
          userIdentity: { principalId: "TEST" },
          requestParameters: { sourceIPAddress: "127.0.0.1" },
          responseElements: {
            "x-amz-request-id": "TEST",
            "x-amz-id-2": "TEST",
          },
          s3: {
            s3SchemaVersion: "1.0",
            configurationId: "test",
            bucket: {
              name: "test-bucket",
              ownerIdentity: { principalId: "TEST" },
              arn: "arn:aws:s3:::test-bucket",
            },
            object: {
              key: "uploaded/file+with+spaces.csv",
              size: 50,
              eTag: "test",
              sequencer: "test",
            },
          },
        },
      ],
    };

    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

    await handler(event);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("uploaded/file with spaces.csv")
    );

    consoleLogSpy.mockRestore();
  });

  test("should log valid products", async () => {
    const csvData = `title,description,price,count
Valid Product,Test description,100,50`;

    s3Mock.on(GetObjectCommand).resolves({
      Body: createReadableStream(csvData) as any,
    });

    const event: S3Event = {
      Records: [
        {
          eventVersion: "2.1",
          eventSource: "aws:s3",
          awsRegion: "us-east-1",
          eventTime: "2024-01-01T00:00:00.000Z",
          eventName: "ObjectCreated:Put",
          userIdentity: { principalId: "TEST" },
          requestParameters: { sourceIPAddress: "127.0.0.1" },
          responseElements: {
            "x-amz-request-id": "TEST",
            "x-amz-id-2": "TEST",
          },
          s3: {
            s3SchemaVersion: "1.0",
            configurationId: "test",
            bucket: {
              name: "test-bucket",
              ownerIdentity: { principalId: "TEST" },
              arn: "arn:aws:s3:::test-bucket",
            },
            object: {
              key: "uploaded/valid.csv",
              size: 50,
              eTag: "test",
              sequencer: "test",
            },
          },
        },
      ],
    };

    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

    await handler(event);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Valid product: Valid Product - $100")
    );

    consoleLogSpy.mockRestore();
  });

  test("should warn about invalid products", async () => {
    const csvData = `title,description,price,count
Invalid Product,,`;

    s3Mock.on(GetObjectCommand).resolves({
      Body: createReadableStream(csvData) as any,
    });

    const event: S3Event = {
      Records: [
        {
          eventVersion: "2.1",
          eventSource: "aws:s3",
          awsRegion: "us-east-1",
          eventTime: "2024-01-01T00:00:00.000Z",
          eventName: "ObjectCreated:Put",
          userIdentity: { principalId: "TEST" },
          requestParameters: { sourceIPAddress: "127.0.0.1" },
          responseElements: {
            "x-amz-request-id": "TEST",
            "x-amz-id-2": "TEST",
          },
          s3: {
            s3SchemaVersion: "1.0",
            configurationId: "test",
            bucket: {
              name: "test-bucket",
              ownerIdentity: { principalId: "TEST" },
              arn: "arn:aws:s3:::test-bucket",
            },
            object: {
              key: "uploaded/invalid.csv",
              size: 50,
              eTag: "test",
              sequencer: "test",
            },
          },
        },
      ],
    };

    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();

    await handler(event);

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Invalid product record")
    );

    consoleWarnSpy.mockRestore();
  });

  test("should handle S3 errors gracefully", async () => {
    s3Mock.on(GetObjectCommand).rejects(new Error("S3 access denied"));

    const event: S3Event = {
      Records: [
        {
          eventVersion: "2.1",
          eventSource: "aws:s3",
          awsRegion: "us-east-1",
          eventTime: "2024-01-01T00:00:00.000Z",
          eventName: "ObjectCreated:Put",
          userIdentity: { principalId: "TEST" },
          requestParameters: { sourceIPAddress: "127.0.0.1" },
          responseElements: {
            "x-amz-request-id": "TEST",
            "x-amz-id-2": "TEST",
          },
          s3: {
            s3SchemaVersion: "1.0",
            configurationId: "test",
            bucket: {
              name: "test-bucket",
              ownerIdentity: { principalId: "TEST" },
              arn: "arn:aws:s3:::test-bucket",
            },
            object: {
              key: "uploaded/error.csv",
              size: 50,
              eTag: "test",
              sequencer: "test",
            },
          },
        },
      ],
    };

    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    await expect(handler(event)).rejects.toThrow("S3 access denied");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error processing file"),
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  test("should handle empty CSV file", async () => {
    const csvData = `title,description,price,count`;

    s3Mock.on(GetObjectCommand).resolves({
      Body: createReadableStream(csvData) as any,
    });

    const event: S3Event = {
      Records: [
        {
          eventVersion: "2.1",
          eventSource: "aws:s3",
          awsRegion: "us-east-1",
          eventTime: "2024-01-01T00:00:00.000Z",
          eventName: "ObjectCreated:Put",
          userIdentity: { principalId: "TEST" },
          requestParameters: { sourceIPAddress: "127.0.0.1" },
          responseElements: {
            "x-amz-request-id": "TEST",
            "x-amz-id-2": "TEST",
          },
          s3: {
            s3SchemaVersion: "1.0",
            configurationId: "test",
            bucket: {
              name: "test-bucket",
              ownerIdentity: { principalId: "TEST" },
              arn: "arn:aws:s3:::test-bucket",
            },
            object: {
              key: "uploaded/empty.csv",
              size: 30,
              eTag: "test",
              sequencer: "test",
            },
          },
        },
      ],
    };

    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

    await handler(event);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Successfully processed 0 records")
    );

    consoleLogSpy.mockRestore();
  });
});
