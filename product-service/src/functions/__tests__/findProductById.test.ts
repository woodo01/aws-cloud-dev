import { APIGatewayProxyEvent } from 'aws-lambda';
import { findProductById } from "../findProductById";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { ProductRequest } from "../../types/productRequest";

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('findProductById', () => {
    beforeEach(() => {
        ddbMock.reset();
    });

    it('should return product when valid ID is provided', async () => {
        ddbMock.on(GetCommand).resolves({
            Item: { id: '1', 'title': 'test', 'description': 'test', 'price': 1 },
        });

        const event = {
            pathParameters: { id: '1' }
        } as Partial<APIGatewayProxyEvent> as APIGatewayProxyEvent;

        const result = await findProductById(event);

        expect(result.statusCode).toBe(200);
        expect(result.headers).toEqual({
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        });

        const body = JSON.parse(result.body);
        expect(body).toHaveProperty('id', '1');
        expect(body).toHaveProperty('title');
        expect(body).toHaveProperty('description');
        expect(body).toHaveProperty('price');
    });

    it('should return 404 when product is not found', async () => {
        ddbMock.on(GetCommand).resolves({});

        const event = {
            pathParameters: { id: 'nonexistent-id' }
        } as Partial<APIGatewayProxyEvent> as APIGatewayProxyEvent;

        const result = await findProductById(event);

        expect(result.statusCode).toBe(404);
        const body = JSON.parse(result.body);
        expect(body).toHaveProperty('message', 'Product not found');
    });

    it('should return 400 when no ID is provided', async () => {
        const event = {
            pathParameters: null
        } as APIGatewayProxyEvent;

        const result = await findProductById(event);

        expect(result.statusCode).toBe(400);
        const body = JSON.parse(result.body);
        expect(body).toHaveProperty('message', 'Product ID is required');
    });
});