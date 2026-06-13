import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3notifications from "aws-cdk-lib/aws-s3-notifications";
import * as sqs from "aws-cdk-lib/aws-sqs";

export class ImportServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket for file imports
    const importBucket = new s3.Bucket(this, "ImportBucket", {
      bucketName: `product-import-${this.account}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Only for dev - use RETAIN in production
      autoDeleteObjects: true, // Only for dev
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
          ],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
        },
      ],
    });

    // SQS Queue for import processing
    const importQueue = new sqs.Queue(this, "ImportQueue", {
      queueName: "ProductImportQueue",
      visibilityTimeout: cdk.Duration.seconds(300),
      retentionPeriod: cdk.Duration.days(14),
    });

    // Dead Letter Queue for failed imports
    const importDLQ = new sqs.Queue(this, "ImportDLQ", {
      queueName: "ProductImportDLQ",
      retentionPeriod: cdk.Duration.days(14),
    });

    // Lambda Function: importProductsFile
    const importProductsFileFn = new NodejsFunction(this, "ImportProductsFileFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      entry: "lambda/importProductsFile.ts",
      handler: "handler",
      bundling: {
        minify: false,
        sourceMap: true,
        externalModules: [],
        forceDockerBundling: false,
      },
      environment: {
        BUCKET_NAME: importBucket.bucketName,
      },
    });

    // Grant S3 permissions to Lambda function
    importBucket.grantReadWrite(importProductsFileFn);

    // Lambda Function: importFileParser
    // Triggered by S3 ObjectCreated events in the uploaded/ folder
    const importFileParserFn = new NodejsFunction(this, "ImportFileParserFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(60),
      entry: "lambda/importFileParser.ts",
      handler: "handler",
      bundling: {
        minify: false,
        sourceMap: true,
        externalModules: [],
        forceDockerBundling: false,
      },
      environment: {
        BUCKET_NAME: importBucket.bucketName,
      },
    });

    // Grant S3 read permissions to importFileParser
    importBucket.grantRead(importFileParserFn);

    // Configure S3 event notification
    // Trigger Lambda when objects are created in the uploaded/ folder
    importBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3notifications.LambdaDestination(importFileParserFn),
      {
        prefix: "uploaded/",
      }
    );

    // API Gateway for Import Service
    const api = new apigateway.RestApi(this, "ImportServiceApi", {
      restApiName: "Import Service",
      description: "This API handles product imports",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ["GET", "POST"],
        allowHeaders: ["Content-Type", "X-Amz-Date", "Authorization", "X-Api-Key"],
      },
    });

    // /import resource
    const importResource = api.root.addResource("import");

    // GET /import - Generate signed URL for file upload
    importResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(importProductsFileFn)
    );

    // CloudFormation Outputs
    new cdk.CfnOutput(this, "ImportServiceApiURL", {
      value: api.url!,
      description: "Import Service API Gateway URL",
    });

    new cdk.CfnOutput(this, "ImportBucketName", {
      value: importBucket.bucketName,
      description: "S3 bucket for product imports",
    });

    new cdk.CfnOutput(this, "ImportQueueURL", {
      value: importQueue.queueUrl,
      description: "SQS queue URL for import processing",
    });

    new cdk.CfnOutput(this, "ImportQueueARN", {
      value: importQueue.queueArn,
      description: "SQS queue ARN for import processing",
    });

    new cdk.CfnOutput(this, "ImportFileParserFunctionName", {
      value: importFileParserFn.functionName,
      description: "Lambda function name for file parsing",
    });
  }
}
