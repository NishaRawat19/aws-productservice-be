import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";

export class AuthorizationServiceStack extends cdk.Stack {
  public readonly basicAuthorizerFn: lambda.IFunction;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Lambda Function: basicAuthorizer
    // This function will validate requests using Basic Auth
    this.basicAuthorizerFn = new NodejsFunction(this, "BasicAuthorizerFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      entry: "lambda/basicAuthorizer.ts",
      handler: "handler",
      bundling: {
        minify: false,
        sourceMap: true,
        externalModules: [],
        forceDockerBundling: false,
      },
      environment: {
        // Store credentials as environment variables (for demo purposes)
        // In production, use AWS Secrets Manager or Parameter Store
        // Format: username=password (separated by =)
        // Source value is read from process.env.BASIC_AUTH_CREDENTIALS at synth time
        CREDENTIALS: process.env.BASIC_AUTH_CREDENTIALS ?? "",
      },
    });

    // CloudFormation Outputs
    new cdk.CfnOutput(this, "BasicAuthorizerFunctionName", {
      value: this.basicAuthorizerFn.functionName,
      description: "Lambda function name for basic authorization",
    });

    new cdk.CfnOutput(this, "BasicAuthorizerFunctionArn", {
      value: this.basicAuthorizerFn.functionArn,
      description: "Lambda function ARN for basic authorization",
      exportName: "BasicAuthorizerFunctionArn",
    });
  }
}
