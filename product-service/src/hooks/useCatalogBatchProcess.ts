import { Stack } from "aws-cdk-lib";
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import path from "node:path";
import * as cdk from "aws-cdk-lib";
import dotenv from 'dotenv';

dotenv.config();

export function useCatalogBatchProcess(stack: Stack, productTableName: string, stockTableName: string) {
  const createProductTopic = new sns.Topic(stack, 'CreateProductTopic', {
    topicName: 'createProductTopic',
  });
  createProductTopic.addSubscription(
    new subscriptions.EmailSubscription(process.env.EMAIL_1 as string, {
      filterPolicy: {
        price: sns.SubscriptionFilter.numericFilter({
          greaterThanOrEqualTo: 50,
        }),
      },
      json: false,
    })
  );
  createProductTopic.addSubscription(
    new subscriptions.EmailSubscription(process.env.EMAIL_2 as string, {
      filterPolicy: {
        price: sns.SubscriptionFilter.numericFilter({
          lessThan: 50,
        }),
      },
      json: false,
    })
  );

  const catalogItemsQueue = new sqs.Queue(stack, 'CatalogItemsQueue', {
    queueName: 'catalogItemsQueue',
  });

  const catalogBatchProcess = new NodejsFunction(stack, 'CatalogBatchProcess', {
    runtime: lambda.Runtime.NODEJS_18_X,
    handler: 'catalogBatchProcess',
    entry: path.join(__dirname, '../functions/catalogBatchProcess/handler.ts'),
    timeout: cdk.Duration.seconds(30),
    bundling: {
      externalModules: [],
      minify: true,
      sourceMap: true,
    },
    environment: {
      SNS_TOPIC_ARN: createProductTopic.topicArn,
      PRODUCTS_TABLE: productTableName,
      STOCKS_TABLE: stockTableName,
    },
  });

  catalogBatchProcess.addEventSource(new lambdaEventSources.SqsEventSource(catalogItemsQueue, {
    batchSize: 5,
  }));

  return {
    createProductTopic,
    catalogItemsQueue,
    catalogBatchProcess,
  }
}