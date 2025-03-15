import { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { importProductsFile } from '../handler';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
    getSignedUrl: jest.fn()
  }));

const s3Mock = mockClient(S3Client);

describe('importProductsFile Lambda', () => {
  beforeEach(() => {
    s3Mock.reset();
    jest.clearAllMocks();
    (getSignedUrl as jest.Mock).mockResolvedValue('https://mock-signed-url.com');
  }
);

  it('should return 400 if filename is not provided', async () => {
    const event = {
      queryStringParameters: null
    } as APIGatewayProxyEvent;

    const result = await importProductsFile(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      message: 'File name is required'
    });
  });

  it('should return signed URL when filename is provided', async () => {
    const mockSignedUrl = 'https://mock-signed-url.com';
    (getSignedUrl as jest.Mock).mockResolvedValue(mockSignedUrl);

    const event = {
      queryStringParameters: { name: 'test.csv' }
    } as unknown as APIGatewayProxyEvent;

    const result = await importProductsFile(event);

    expect(result.statusCode).toBe(200);
    expect(result.headers).toEqual({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    });
    expect(JSON.parse(result.body)).toBe(mockSignedUrl);

    expect(getSignedUrl).toHaveBeenCalledTimes(1);
    const [client, command, options] = (getSignedUrl as jest.Mock).mock.calls[0];
    
    expect(command.input).toEqual({
      Bucket: 'aws-be-import-service-bucket',
      Key: 'uploaded/test.csv',
      ContentType: 'text/csv'
    });
    expect(options).toEqual({ expiresIn: 60 * 5 });
  });

  it('should return 500 when S3 operation fails', async () => {
    (getSignedUrl as jest.Mock).mockRejectedValue(new Error('S3 Error'));

    const event = {
      queryStringParameters: {
        name: 'test.csv'
      }
    } as unknown as APIGatewayProxyEvent;

    const result = await importProductsFile(event);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Error generating signed URL'
    });
  });
});
