import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand, TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { ProductRequest } from "../types/productRequest";
import { logger } from "../services/logger";

const client = new DynamoDBClient();
const dynamodb = DynamoDBDocumentClient.from(client);
const productTable = process.env.PRODUCT_TABLE as string;
const stockTable = process.env.STOCK_TABLE as string;

export const createProduct = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  logger.info('Request received', {
    path: event.path,
    httpMethod: event.httpMethod,
    pathParameters: event.pathParameters,
    queryStringParameters: event.queryStringParameters,
    body: event.body ? JSON.parse(event.body) : null
  });

  try {
    if (!event.body) {
      logger.error('No body provided');
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ message: 'Request body is missing' }),
      };
    }
    let productRequest: ProductRequest;
    try {
      productRequest = JSON.parse(event.body);
      logger.info('Parsed product data:', { productData: productRequest });
    } catch (error) {
      logger.error('Error parsing request body:', { error });
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ message: 'Invalid JSON in request body' }),
      };
    }

    if (!productRequest.title || !productRequest.description || productRequest.price === undefined || productRequest.count === undefined) {
      logger.error('Missing required fields');
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'Missing required fields. Please provide title, description, price, and count.'
        }),
      };
    }

    if (typeof productRequest.title !== 'string' || typeof productRequest.description !== 'string'
      || typeof productRequest.price !== 'number' || typeof productRequest.count !== 'number') {
      logger.error('Invalid data types');
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'Invalid data types. Title and description must be strings, price and count must be numbers.'
        }),
      };
    }

    const productId = uuidv4();
    logger.info('Generated product ID:', productId);
    const { id, ...rest } = productRequest;
    const product = {
      ...rest,
      id: productId,
    };

    const stock = {
      product_id: productId,
      count: productRequest.count,
    };

    const transactParams: TransactWriteCommandInput = {
      TransactItems: [
        {
          Put: {
            TableName: productTable,
            Item: product
          }
        },
        {
          Put: {
            TableName: stockTable,
            Item: stock
          }
        }
      ]
    };

    logger.info('Executing transaction:', JSON.stringify(transactParams));
    await dynamodb.send(new TransactWriteCommand(transactParams));
    logger.info('Transaction completed successfully');

    const createdProduct = {
      ...product,
      count: stock.count
    };

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(createdProduct),
    };
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Error creating product:', { error });

      if (error.name === 'TransactionCanceledException') {
        logger.error('Transaction was cancelled. One or more conditions were not met.');
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            message: 'Transaction failed. The product or stock may already exist.',
            error: error.message
          }),
        };
      }
    }

    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    logger.error('Error details:', errorMessage);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
};
