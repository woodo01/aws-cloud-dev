import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SQSEvent } from 'aws-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { logger } from "../services/logger";

dotenv.config();
const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient());
const productsTable = process.env.PRODUCT_TABLE || 'product';
const stocksTable = process.env.STOCK_TABLE || 'stock';
const sns = new SNSClient({ region: process.env.CDK_DEFAULT_REGION });
const topicArn = process.env.TOPIC_ARN;

function isBodyValid(body: any) {
  return typeof body === 'string'
}

function isProductDataValid(productData: any) {
  return productData.title ||
    typeof productData.price === 'number' ||
    typeof productData.count === 'number'
}

export const catalogBatchProcess = async (event: SQSEvent) => {
  try {
    logger.info('Processing SQS messages', { recordCount: event.Records.length });

    for (const record of event.Records) {
      let productData;

      try {
        if (!isBodyValid(record.body)) {
          throw new Error('Record body is not a string');
        }
        productData = JSON.parse(record.body);
        if (!isProductDataValid(productData)) {
          throw new Error('Invalid product data structure');
        }
        const productId = uuidv4();
        logger.info('Processing product:', { productData, productId });
        await dynamodb.send(new PutCommand({
          TableName: productsTable,
          Item: {
            id: productId,
            title: productData.title,
            description: productData.description || '',
            price: productData.price
          }
        }));
        await dynamodb.send(new PutCommand({
          TableName: stocksTable,
          Item: {
            product_id: productId,
            count: productData.count
          }
        }));

        logger.info('Successfully created product and stock:', { productId: productData.id });

        try {
          await sns.send(new PublishCommand({
            TopicArn: topicArn,
            Message: JSON.stringify({
              message: `Product created: ${productData.title}`,
              product: productData
            }),
            MessageAttributes: {
              price: {
                DataType: 'Number',
                StringValue: productData.price.toString()
              }
            }
          }));
          logger.info('SNS notification sent successfully');
        } catch (error) {
          logger.error('Error sending SNS notification:', { error });
        }
      } catch (e) {
        logger.error('Error processing a record:', { error: e, record: record.body });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Products processed successfully' })
    };
  } catch (error) {
    logger.error('Error processing products:', { error });

    await sns.send(new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify({ error }),
      Subject: 'Error Creating Products',
    }));
    throw error;
  }
};
