import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const BUCKET_NAME = process.env.BUCKET_NAME || 'aws-be-import-service-bucket';
const REGION = process.env.REGION || 'eu-central-1';
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': true,
}

const s3Client = new S3Client({ region: REGION });

export const importProductsFile = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const fileName = event.queryStringParameters?.name;
    
    if (!fileName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'File name is required' }),
      };
    }

    const key = `uploaded/${fileName}`;
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: 'text/csv',
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 * 5 });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(signedUrl),
    };
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Error generating signed URL' }),
    };
  }
};
