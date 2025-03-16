import { SQSEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { catalogBatchProcess } from "../catalogBatchProcess/handler";

const ddbMock = mockClient(DynamoDBDocumentClient);
const snsMock = mockClient(SNSClient);

process.env.PRODUCTS_TABLE = 'product';
process.env.STOCKS_TABLE = 'stock';
process.env.SNS_TOPIC_ARN = 'test-topic-arn';
process.env.REGION = 'eu-central-1';

describe('catalogBatchProcess', () => {
  beforeEach(() => {
    ddbMock.reset();
    snsMock.reset();
  });

  it('should process valid SQS messages successfully', async () => {
    const sqsEvent: SQSEvent = {
      Records: [
        {
          body: JSON.stringify({
            title: 'Test Product',
            description: 'Test Description',
            price: 100,
            count: 10
          }),
          messageId: '1',
          receiptHandle: 'test-receipt',
          attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: '1234567890',
            SenderId: 'TEST-ID',
            ApproximateFirstReceiveTimestamp: '1234567890'
          },
          messageAttributes: {},
          md5OfBody: 'test-md5',
          eventSource: 'aws:sqs',
          eventSourceARN: 'test:arn',
          awsRegion: 'eu-central-1'
        }
      ]
    };

    ddbMock
      .on(PutCommand)
      .resolves({});

    snsMock
      .on(PublishCommand)
      .resolves({});

    expect(await catalogBatchProcess(sqsEvent)).toEqual({
        statusCode: 200,
        body: JSON.stringify({
          message: 'Products processed successfully'
        })
      });
  });

  it('should handle invalid message body', async () => {
    const sqsEvent: SQSEvent = {
      Records: [
        {
          body: 'invalid-json',
          messageId: '1',
          receiptHandle: 'test-receipt',
          attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: '1234567890',
            SenderId: 'TEST-ID',
            ApproximateFirstReceiveTimestamp: '1234567890'
          },
          messageAttributes: {},
          md5OfBody: 'test-md5',
          eventSource: 'aws:sqs',
          eventSourceARN: 'test:arn',
          awsRegion: 'eu-central-1'
        }
      ]
    };

    expect(await catalogBatchProcess(sqsEvent)).toEqual({
      statusCode: 200,
      body: JSON.stringify({
        message: 'Products processed successfully'
      })
    });
  });

  it('should handle missing required fields', async () => {
    const sqsEvent: SQSEvent = {
      Records: [
        {
          body: JSON.stringify({
            description: 'Missing required fields'
          }),
          messageId: '1',
          receiptHandle: 'test-receipt',
          attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: '1234567890',
            SenderId: 'TEST-ID',
            ApproximateFirstReceiveTimestamp: '1234567890'
          },
          messageAttributes: {},
          md5OfBody: 'test-md5',
          eventSource: 'aws:sqs',
          eventSourceARN: 'test:arn',
          awsRegion: 'eu-central-1'
        }
      ]
    };

    expect(await catalogBatchProcess(sqsEvent)).toEqual({
      statusCode: 200,
      body: JSON.stringify({
        message: 'Products processed successfully'
      })
    });
  });
});
