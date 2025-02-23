import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import path from "node:path";

export class ProductStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const api = new apigateway.RestApi(this, 'ProductApi', {
      restApiName: 'Product Service',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const products = api.root.addResource('products');
    products.addMethod('GET', new apigateway.LambdaIntegration(
      new NodejsFunction(this, 'getProductList', {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: 'getProductList',
        entry: path.join(__dirname, '../src/functions/getProductList.ts'),
        bundling: {
          externalModules: ['aws-sdk'],
          minify: true,
          sourceMap: true,
        },
      })));

    const product = products.addResource('{id}');
    product.addMethod('GET', new apigateway.LambdaIntegration(
      new NodejsFunction(this, 'findProductById', {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: 'findProductById',
        entry: path.join(__dirname, '../src/functions/findProductById.ts'),
        bundling: {
          externalModules: ['aws-sdk'],
          minify: true,
          sourceMap: true,
        },
      })));
  }
}
