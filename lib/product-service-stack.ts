import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class ProductServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const getProductsListFn = new lambda.Function(this, "GetProductsListFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize:1024,
      timeout: cdk.Duration.seconds(10),
      code: lambda.Code.fromAsset("lambda"),
      handler: "getProductsList.handler",
      
    });
    const getProductByIdFn = new lambda.Function(this, "GetProductByIdFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize:1024,
      timeout: cdk.Duration.seconds(10),
      code: lambda.Code.fromAsset("lambda"),
      handler: "getProductById.handler",
    });

    // API Gateway
    const api = new apigateway.RestApi(this, "ProductServiceApi", {
      restApiName: "Product Service",
      description: "This API return the products list",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ["GET"],
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
    productByIdResource.addMethod(
  "GET",
  new apigateway.LambdaIntegration(getProductByIdFn)
);

    new cdk.CfnOutput(this, "API_URL", {
      value: api.url!,
    });

  }
}
