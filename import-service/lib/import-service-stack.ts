import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';
import { useQueue } from "../src/hooks/useQueue";

export interface ImportServiceProps extends cdk.StackProps {
  bucketName?: string;
  basicAuthorizerArn?: string;
  queueUrl?: string;
}

export class ImportServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: ImportServiceProps) {
    super(scope, id, props);

    // Get environment variables with defaults from props
    const bucketName = props?.bucketName || process.env.BUCKET_NAME || "my-bucket";
    const basicAuthorizerArn = props?.basicAuthorizerArn || process.env.BASIC_AUTHORIZER;
    const queueUrl = props?.queueUrl || process.env.QUEUE_URL;

    if (!basicAuthorizerArn) {
      throw new Error('Basic authorizer ARN is required');
    }

    if (!queueUrl) {
      throw new Error('Queue URL is required');
    }

    const bucket = s3.Bucket.fromBucketName(this, 'ImportBucket', bucketName);
    const { catalogItemsQueue } = useQueue(this);

    // Create authorizer
    const authorizer = this.createAuthorizer(basicAuthorizerArn);

    // Create Lambda functions
    const importProductsFileLambda = this.createImportProductsFileLambda(bucket);
    const importFileParserLambda = this.createImportFileParserLambda(bucket, queueUrl, catalogItemsQueue);

    // Configure S3 event notification
    this.configureS3EventNotification(bucket, importFileParserLambda);

    // Create API Gateway
    const api = this.createApiGateway(importProductsFileLambda, authorizer);

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'The URL of the Import API',
    });
  }

  private createAuthorizer(authorizerArn: string): apigateway.TokenAuthorizer {
    const authorizerFn = lambda.Function.fromFunctionArn(
      this,
      'BasicAuthorizer',
      authorizerArn
    );

    return new apigateway.TokenAuthorizer(this, 'ImportApiAuthorizer', {
      handler: authorizerFn,
      identitySource: apigateway.IdentitySource.header('Authorization'),
      resultsCacheTtl: cdk.Duration.seconds(0)
    });
  }

  private createImportProductsFileLambda(bucket: s3.IBucket): NodejsFunction {
    const lambda = this.createNodejsFunction('ImportProductsFileLambda', {
      handler: 'importProductsFile',
      entry: path.join(__dirname, '../src/functions/importProductsFile/handler.ts'),
      environment: {
        BUCKET_NAME: bucket.bucketName,
        REGION: this.region,
      },
    });
    
    bucket.grantReadWrite(lambda);
    return lambda;
  }

  private createImportFileParserLambda(
    bucket: s3.IBucket, 
    queueUrl: string,
    catalogItemsQueue: cdk.aws_sqs.IQueue
  ): NodejsFunction {
    const lambda = this.createNodejsFunction('ImportFileParserLambda', {
      functionName: 'importFileParser',
      handler: 'importFileParser',
      entry: path.join(__dirname, '../src/functions/importFileParser/handler.ts'),
      environment: {
        BUCKET_NAME: bucket.bucketName,
        REGION: this.region,
        QUEUE_URL: queueUrl,
      },
    });
    
    bucket.grantReadWrite(lambda);
    
    lambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sqs:SendMessage'],
        resources: [catalogItemsQueue.queueArn],
      })
    );
    
    return lambda;
  }

  private configureS3EventNotification(bucket: s3.IBucket, lambda: NodejsFunction): void {
    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(lambda),
      { prefix: 'uploaded/' }
    );
  }

  private createApiGateway(
    importProductsFileLambda: NodejsFunction,
    authorizer: apigateway.TokenAuthorizer
  ): apigateway.RestApi {
    const api = new apigateway.RestApi(this, 'ImportApi', {
      restApiName: 'Import Service',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
    });
    
    const importResource = api.root.addResource('import');
    importResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(importProductsFileLambda, {
        proxy: true,
        integrationResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': "'*'",
            },
          },
        ],
      }),
      {
        authorizer: authorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        requestParameters: {
          'method.request.querystring.name': true,
        },
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '401',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '403',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
        ],
      }
    );
    
    return api;
  }

  private createNodejsFunction(
    id: string, 
    props: Partial<NodejsFunctionProps>
  ): NodejsFunction {
    return new NodejsFunction(this, id, {
      runtime: lambda.Runtime.NODEJS_18_X,
      bundling: {
        externalModules: [],
        minify: true,
        sourceMap: true,
      },
      ...props,
    });
  }
}
