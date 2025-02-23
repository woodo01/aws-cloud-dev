import { APIGatewayProxyEvent } from 'aws-lambda';
import { findProductById } from "../findProductById";

describe('findProductById', () => {
    it('should return product when valid ID is provided', async () => {
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