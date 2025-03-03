import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand, TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { ProductRequest } from "../types/productRequest";

const client = new DynamoDBClient();
const dynamodb = DynamoDBDocumentClient.from(client);
const productTable = process.env.PRODUCT_TABLE as string;
const stockTable = process.env.STOCK_TABLE as string;

export const createProduct = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) {
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
      console.log('Parsed product data:', { productData: productRequest });
    } catch (error) {
      console.log('Error parsing request body:', { error });
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

    await dynamodb.send(new TransactWriteCommand(transactParams));
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
