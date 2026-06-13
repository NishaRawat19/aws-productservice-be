import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as snsSubscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";

export class ProductServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Tables
    // Products Table
    const productsTable = new dynamodb.Table(this, "ProductsTable", {
      tableName: "Products",
      partitionKey: {
        name: "id",
        type: dynamodb.AttributeType.STRING,
      },
    });

    // Stock Table
    const stockTable = new dynamodb.Table(this, "StockTable", {
      tableName: "Stock",
      partitionKey: {
        name: "product_id",
        type: dynamodb.AttributeType.STRING,
      },
    });

    // SQS Queue for batch processing
    const catalogItemsQueue = new sqs.Queue(this, "CatalogItemsQueue", {
      queueName: "catalogItemsQueue",
    });

    // SNS Topic for product creation notifications
    const createProductTopic = new sns.Topic(this, "CreateProductTopic", {
      topicName: "createProductTopic",
      displayName: "Product Creation Notifications",
    });

    // Add email subscription to SNS topic
    // Replace with your email address
    createProductTopic.addSubscription(
      new snsSubscriptions.EmailSubscription("nisharawat.19@gmail.com")
    );

    const getProductsListFn = new NodejsFunction(this, "GetProductsListFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(10),
      entry: "lambda/getProductsList.ts",
      handler: "handler",
      bundling: {
        minify: false,
        sourceMap: true,
        externalModules: [],
        forceDockerBundling: false,
      },
      environment: {
        PRODUCTS_TABLE_NAME: productsTable.tableName,
        STOCK_TABLE_NAME: stockTable.tableName,
      },
    });

    const getProductByIdFn = new NodejsFunction(this, "GetProductByIdFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(10),
      entry: "lambda/getProductById.ts",
      handler: "handler",
      bundling: {
        minify: false,
        sourceMap: true,
        externalModules: [],
        forceDockerBundling: false,
      },
      environment: {
        PRODUCTS_TABLE_NAME: productsTable.tableName,
        STOCK_TABLE_NAME: stockTable.tableName,
      },
    });

    const createProductFn = new NodejsFunction(this, "CreateProductFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(10),
      entry: "lambda/createProduct.ts",
      handler: "handler",
      bundling: {
        minify: false,
        sourceMap: true,
        externalModules: [],
        forceDockerBundling: false,
      },
      environment: {
        PRODUCTS_TABLE_NAME: productsTable.tableName,
      },
    });

    const catalogBatchProcessFn = new NodejsFunction(this, "CatalogBatchProcessFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      entry: "lambda/catalogBatchProcess.ts",
      handler: "handler",
      bundling: {
        minify: false,
        sourceMap: true,
        externalModules: [],
        forceDockerBundling: false,
      },
      environment: {
        PRODUCTS_TABLE_NAME: productsTable.tableName,
        STOCK_TABLE_NAME: stockTable.tableName,
        CREATE_PRODUCT_TOPIC_ARN: createProductTopic.topicArn,
      },
    });

    // Grant Lambda functions read/write permissions to DynamoDB tables
    productsTable.grantReadWriteData(getProductsListFn);
    productsTable.grantReadWriteData(getProductByIdFn);
    productsTable.grantReadWriteData(createProductFn);
    productsTable.grantReadWriteData(catalogBatchProcessFn);
    stockTable.grantReadWriteData(getProductsListFn);
    stockTable.grantReadWriteData(getProductByIdFn);
    stockTable.grantReadWriteData(catalogBatchProcessFn);

    // Grant SNS publish permissions to catalogBatchProcess Lambda
    createProductTopic.grantPublish(catalogBatchProcessFn);

    // Configure SQS to trigger Lambda with batch size of 5
    catalogBatchProcessFn.addEventSource(
      new SqsEventSource(catalogItemsQueue, {
        batchSize: 5,
      })
    );

    // API Gateway
    const api = new apigateway.RestApi(this, "ProductServiceApi", {
      restApiName: "Product Service",
      description: "This API return the products list",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ["GET", "POST"],
        allowHeaders: ["Content-Type", "X-Amz-Date", "Authorization", "X-Api-Key"],
      },
    });
        // /products resource
    const productsResource = api.root.addResource("products");
    const productByIdResource = productsResource.addResource("{id}");

    // GET /products
    productsResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getProductsListFn)
    );

    // POST /products
    productsResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(createProductFn)
    );

    // GET /products/{id}
    productByIdResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getProductByIdFn)
    );

    new cdk.CfnOutput(this, "API_URL", {
      value: api.url!,
    });

    new cdk.CfnOutput(this, "ProductsTableName", {
      value: productsTable.tableName,
      description: "DynamoDB table name for products",
    });

    new cdk.CfnOutput(this, "StockTableName", {
      value: stockTable.tableName,
      description: "DynamoDB table name for stock",
    });

    new cdk.CfnOutput(this, "CatalogItemsQueueUrl", {
      value: catalogItemsQueue.queueUrl,
      description: "SQS Queue URL for catalog batch processing",
    });

    new cdk.CfnOutput(this, "CatalogItemsQueueArn", {
      value: catalogItemsQueue.queueArn,
      description: "SQS Queue ARN for catalog batch processing",
      exportName: "CatalogItemsQueueArn",
    });

    new cdk.CfnOutput(this, "CreateProductTopicArn", {
      value: createProductTopic.topicArn,
      description: "SNS Topic ARN for product creation notifications",
    });

  }
}
