import { S3Event } from 'aws-lambda';
import { S3Client, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Logger } from '@aws-lambda-powertools/logger';
import csvParser from 'csv-parser';
import { Readable } from 'stream';

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const logger = new Logger({ serviceName: 'importFileParser' });

export const importFileParser = async (event: S3Event) => {
  try {
    logger.info('Processing S3 event', { event });

    for (const record of event.Records) {
      const bucket = record.s3.bucket.name;
      const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

      if (!key.startsWith('uploaded/')) {
        logger.info('Skipping file not in uploaded folder', { key });
        continue;
      }

      logger.info('Processing file', { bucket, key });

      const { Body } = await s3Client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        })
      );

      if (!Body) {
        throw new Error('Empty file body');
      }

      const stream = Body as Readable;

      await new Promise((resolve, reject) => {
        stream
          .pipe(csvParser())
          .on('data', (data) => {
            logger.info('Parsed CSV record', { data });
          })
          .on('error', (error) => {
            logger.error('Error parsing CSV', { error });
            reject(error);
          })
          .on('end', async () => {
            try {
              const newKey = key.replace('uploaded/', 'parsed/');

              await s3Client.send(new CopyObjectCommand({
                Bucket: bucket,
                CopySource: `${bucket}/${key}`,
                Key: newKey
              }));

              logger.info('File copied to parsed folder', { newKey });

              await s3Client.send(new DeleteObjectCommand({
                Bucket: bucket,
                Key: key
              }));

              logger.info('File deleted from uploaded folder', { key });
              resolve(null);
            } catch (error) {
              logger.error('Error moving file', { error });
              reject(error);
            }
          });
      });
    }

    return { statusCode: 200, body: 'Processing completed' };
  } catch (error) {
    logger.error('Error processing S3 event', { error });
    throw error;
  }
};
