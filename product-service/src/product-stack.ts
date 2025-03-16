import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import path from "node:path";
import { useCatalogBatchProcess } from "./hooks/useCatalogBatchProcess";

export class ProductStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const productTable = dynamodb.Table.fromTableName(
      this,
      'ExistingProductsTable',
      'product'
    );

    const stockTable = dynamodb.Table.fromTableName(
      this,
      'ExistingStocksTable',
      'stock'
    );

    const getProductListFunction = new NodejsFunction(this, 'GetProductListFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'getProductList',
      entry: path.join(__dirname, '../src/functions/getProductList.ts'),
      bundling: {
        externalModules: [],
        minify: true,
        sourceMap: true,
      },
      environment: {
        PRODUCTS_TABLE: productTable.tableName,
        STOCKS_TABLE: stockTable.tableName,
      },
    });

    const findProductByIdFunction = new NodejsFunction(this, 'FindProductByIdFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'findProductById',
      entry: path.join(__dirname, '../src/functions/findProductById.ts'),
      bundling: {
        externalModules: [],
        minify: true,
        sourceMap: true,
      },
      environment: {
        PRODUCTS_TABLE: productTable.tableName,
        STOCKS_TABLE: stockTable.tableName,
      },
    });

    const createProductFunction = new NodejsFunction(this, 'CreateProductFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'createProduct',
      entry: path.join(__dirname, '../src/functions/createProduct.ts'),
      bundling: {
        externalModules: [],
        minify: true,
        sourceMap: true,
      },
      environment: {
        PRODUCT_TABLE: productTable.tableName,
        STOCK_TABLE: stockTable.tableName,
      },
      timeout: cdk.Duration.seconds(30),
    });

    productTable.grantReadData(getProductListFunction);
    stockTable.grantReadData(getProductListFunction);
    productTable.grantReadData(findProductByIdFunction);
    stockTable.grantReadData(findProductByIdFunction);
    productTable.grantWriteData(createProductFunction);
    stockTable.grantWriteData(createProductFunction);

    const {createProductTopic,catalogItemsQueue, catalogBatchProcess} = useCatalogBatchProcess(this, productTable.tableName, stockTable.tableName);
    productTable.grantWriteData(catalogBatchProcess);
    stockTable.grantWriteData(catalogBatchProcess);
    createProductTopic.grantPublish(catalogBatchProcess);
    catalogItemsQueue.grantConsumeMessages(catalogBatchProcess);

    const api = new apigateway.RestApi(this, 'ProductApi', {
      restApiName: 'Product Service',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
        allowCredentials: true,
      },
    });

    const products = api.root.addResource('products');
    products.addMethod('GET', new apigateway.LambdaIntegration(getProductListFunction));
    products.addMethod('POST', new apigateway.LambdaIntegration(createProductFunction));

    const product = products.addResource('{id}');
    product.addMethod('GET', new apigateway.LambdaIntegration(findProductByIdFunction));

    new cdk.CfnOutput(this, 'ProductsApiEndpoint', {
      value: api.url,
      description: 'The URL of the Products API',
    });
  }
}
