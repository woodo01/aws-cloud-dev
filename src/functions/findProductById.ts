import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Product } from "../types/product";
import { Stock } from "../types/stock";
import { logger } from "../services/logger";

const client = new DynamoDBClient();
const dynamodb = DynamoDBDocumentClient.from(client);
const productTable = process.env.PRODUCT_TABLE as string || 'product';
const stockTable = process.env.STOCK_TABLE as string || 'stock';

export const findProductById = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  logger.info('Request received', {
    path: event.path,
    httpMethod: event.httpMethod,
    pathParameters: event.pathParameters,
    queryStringParameters: event.queryStringParameters,
    body: event.body ? JSON.parse(event.body) : null
  });

  try {
    const productId = event.pathParameters?.id;

    if (!productId) {
      logger.info('Product ID is missing');
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ message: 'Product ID is required' }),
      };
    }

    logger.info('Fetching product:', productId);
    const productResponse = await dynamodb.send(new GetCommand({
      TableName: productTable,
      Key: { id: productId }
    }));

    if (!productResponse.Item) {
      logger.error('Product not found:', productId);
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ message: 'Product not found' }),
      };
    }

    logger.info('Product found:', {product: productResponse.Item});

    logger.info('Fetching stock:', productId);
    const stockResponse = await dynamodb.send(new GetCommand({
      TableName: stockTable,
      Key: { product_id: productId }
    }));

    if (!stockResponse.Item) {
      logger.error('Stock not found: product id - ', productId);
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ message: 'Stock not found' }),
      };
    }

    logger.info('Stock found:', { stock: stockResponse.Item });

    const response = {
      ...productResponse.Item as Product,
      count: (stockResponse.Item as Stock)?.count ?? 0
    }

    logger.info('Send response:', response);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    logger.error('Error fetching product:', { error });
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
