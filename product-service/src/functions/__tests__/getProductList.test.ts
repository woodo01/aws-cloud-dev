import { APIGatewayProxyEvent } from 'aws-lambda';
import { getProductList } from "../getProductList";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

describe('getProductList', () => {
    it('should return list of products with 200 status code', async () => {
        const event = {} as Partial<APIGatewayProxyEvent> as APIGatewayProxyEvent;

        const result = await getProductList(event);

        expect(result.statusCode).toBe(200);
        expect(result.headers).toEqual({
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        });

        const body = JSON.parse(result.body);

        expect(Array.isArray(body)).toBe(true);
        expect(body.length).toBeGreaterThan(0);

        body.forEach((product: any) => {
            expect(product).toHaveProperty('id');
            expect(product).toHaveProperty('title');
            expect(product).toHaveProperty('price');
            expect(typeof product.id).toBe('string');
            expect(typeof product.title).toBe('string');
            expect(typeof product.price).toBe('number');
        });
    });
    it('should return 500 status code', async () => {
        const ddbMock = mockClient(DynamoDBDocumentClient);
        ddbMock.on(ScanCommand).rejects(new Error("Scan operation failed"));

        const event = {} as Partial<APIGatewayProxyEvent> as APIGatewayProxyEvent;
        const result = await getProductList(event);
        expect(result.statusCode).toBe(500);
    });
});
