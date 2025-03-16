import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';
import { useQueue } from "../src/hooks/useQueue";

const bucketName = process.env.BUCKET_NAME || "my-bucket";

export class ImportServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucket = s3.Bucket.fromBucketName(this, 'ImportBucket', bucketName);

    const importProductsFileLambda = new NodejsFunction(this, 'ImportProductsFileLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'importProductsFile',
      entry: path.join(__dirname, '../src/functions/importProductsFile/handler.ts'),
      environment: {
        BUCKET_NAME: bucket.bucketName,
        REGION: this.region,
      },
      bundling: {
        externalModules: [],
        minify: true,
        sourceMap: true,
      },
    });
    bucket.grantReadWrite(importProductsFileLambda);

    const importFileParserLambda = new NodejsFunction(this, 'ImportFileParserLambda', {
      functionName: 'importFileParser',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'importFileParser',
      entry: path.join(__dirname, '../src/functions/importFileParser/handler.ts'),
      environment: {
        BUCKET_NAME: bucket.bucketName,
        REGION: this.region,
      },
      bundling: {
        externalModules: [],
        minify: true,
        sourceMap: true,
      },
    });
    bucket.grantReadWrite(importFileParserLambda);

    const { catalogItemsQueue } = useQueue(this);
    importFileParserLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sqs:SendMessage'],
        resources: [catalogItemsQueue.queueArn],
      })
    );

    const api = new apigateway.RestApi(this, 'ImportApi', {
      restApiName: 'Import Service',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });
    const importResource = api.root.addResource('import');
    importResource.addMethod('GET', new apigateway.LambdaIntegration(importProductsFileLambda), {
      requestParameters: {
        'method.request.querystring.name': true,
      },
    });
    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(importFileParserLambda),
      { prefix: 'uploaded/' }
    );
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'The URL of the Import API',
    });
  }
}
