import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { Product } from "../types/product";
import { Stock } from "../types/stock";
import { logger } from "../services/logger";

const client = new DynamoDBClient();
const dynamodb = DynamoDBDocumentClient.from(client);
const productTable = process.env.PRODUCTS_TABLE || 'product';
const stockTable = process.env.STOCKS_TABLE || 'stock';

export const getProductList = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  logger.info('Request received', {
    path: event.path,
    httpMethod: event.httpMethod,
    pathParameters: event.pathParameters,
    queryStringParameters: event.queryStringParameters,
    body: event.body ? JSON.parse(event.body) : null
  });

  try {
    logger.info('Fetching all products');
    const productsResult = await dynamodb.send(new ScanCommand({ TableName: productTable, }));
    const products: Product[] = productsResult.Items as Product[] || [];
    logger.info('Products fetched', { products });

    logger.info('Fetching all stocks');
    const stocksResult = await dynamodb.send(new ScanCommand({ TableName: stockTable, }));
    const stocks: Stock[] = stocksResult.Items as Stock[] || [];
    logger.info('Stocks fetched', { stocks });

    logger.info('Preparing response');
    const response = products.map(product => {
      return {
        ...product,
        count: stocks.find(s => s.product_id === product.id)?.count ?? 0
      }
    });

    logger.info('Send response', { response });
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    logger.error('Error fetching products:', { error });
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};
