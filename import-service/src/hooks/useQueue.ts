import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Stack } from "aws-cdk-lib";
import dotenv from 'dotenv';

dotenv.config();

export function useQueue(stack: Stack) {
  const catalogItemsQueue = sqs.Queue.fromQueueArn(
    stack,
    'CatalogItemsQueue',
    process.env.QUEUE_ARN as string,
  );
  const rootUserPolicy = new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
      'sqs:SendMessage',
      'sqs:ReceiveMessage',
      'sqs:DeleteMessage',
      'sqs:GetQueueAttributes',
      'sqs:GetQueueUrl',
      'sqs:ListQueues'
    ],
    resources: [catalogItemsQueue.queueArn],
    principals: [
      new iam.AccountRootPrincipal()
    ]
  });
  catalogItemsQueue.addToResourcePolicy(rootUserPolicy);

  return {
    catalogItemsQueue,
  };
}