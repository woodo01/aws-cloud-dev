import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { Product } from '../src/types/product';
import { Stock } from '../src/types/stock';
import { productsData } from './productsData';

const dynamodb = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.AWS_REGION as string
}));

const PRODUCT_TABLE = process.env.PRODUCT_TABLE as string;
const STOCK_TABLE = process.env.STOCK_TABLE as string;

async function clearTables(): Promise<void> {
  try {
    const productsResult = await dynamodb.send(new ScanCommand({
      TableName: PRODUCT_TABLE,
      AttributesToGet: ['id']
    }));
    
    if (productsResult.Items && productsResult.Items.length > 0) {
      for (const item of productsResult.Items) {
        await dynamodb.send(new DeleteCommand({
          TableName: PRODUCT_TABLE,
          Key: { id: item.id }
        }));
      }
    }
    
    const stocksResult = await dynamodb.send(new ScanCommand({
      TableName: STOCK_TABLE,
      AttributesToGet: ['product_id']
    }));
    
    if (stocksResult.Items && stocksResult.Items.length > 0) {
      for (const item of stocksResult.Items) {
        await dynamodb.send(new DeleteCommand({
          TableName: STOCK_TABLE,
          Key: { product_id: item.product_id }
        }));
      }
    }
    
    console.log('Complete');
  } catch (error) {
    console.error('Error: ', error);
    throw error;
  }
}

async function populateTables(): Promise<void> {
  try {
    const args = process.argv.slice(2);
    if (args.includes('--clear')) {
      await clearTables();
    }

    const products: Product[] = [];
    const stocks: Stock[] = [];
    
    for (const productData of productsData) {
      const id = uuidv4();
      products.push({ id, ...productData });
      stocks.push({
        product_id: id,
        count: Math.floor(Math.random() * 5) + 1
      });
    }
    
    for (const product of products) {
      await dynamodb.send(new PutCommand({
        TableName: PRODUCT_TABLE,
        Item: product
      }));
    }
    
    for (const stock of stocks) {
      await dynamodb.send(new PutCommand({
        TableName: STOCK_TABLE,
        Item: stock
      }));
    }
    
    console.log('Completed populated tables...');
  } catch (error) {
    console.error('Error: ', error);
    throw error;
  }
}

populateTables().catch(_ => process.exit(1));
