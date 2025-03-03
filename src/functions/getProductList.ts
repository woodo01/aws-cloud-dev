import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { Product } from "../types/product";
import { Stock } from "../types/stock";

const client = new DynamoDBClient();
const dynamodb = DynamoDBDocumentClient.from(client);
const productTable = process.env.PRODUCTS_TABLE || 'products';
const stockTable = process.env.STOCKS_TABLE || 'stocks';

export const getProductList = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const productsResult = await dynamodb.send(new ScanCommand({ TableName: productTable, }));
    const products: Product[] = productsResult.Items as Product[] || [];
    const stocksResult = await dynamodb.send(new ScanCommand({ TableName: stockTable, }));
    const stocks: Stock[] = stocksResult.Items as Stock[] || [];

    const response = products.map(product => {
      return {
        ...product,
        count: stocks.find(s => s.product_id === product.id)?.count ?? 0
      }
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
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
