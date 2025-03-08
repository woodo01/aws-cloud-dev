import { S3Event } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { importFileParser } from '../handler';
import { sdkStreamMixin } from '@aws-sdk/util-stream';

const s3Mock = mockClient(S3Client);

jest.mock('@aws-lambda-powertools/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('importFileParser Lambda', () => {
  beforeEach(() => {
    s3Mock.reset();
    jest.clearAllMocks();
  });

  it('should process CSV file successfully', async () => {
    const mockCsvData = 'id,title,description\n1,Product 1,Description 1\n2,Product 2,Description 2';
    const mockStream = sdkStreamMixin(Readable.from([mockCsvData]));

    s3Mock.on(GetObjectCommand).resolves({
      Body: mockStream,
      $metadata: { httpStatusCode: 200 }
    });
    s3Mock.on(CopyObjectCommand).resolves({
        $metadata: { httpStatusCode: 200 }
      });
    s3Mock.on(DeleteObjectCommand).resolves({
      $metadata: { httpStatusCode: 200 }
    });

    // Create mock S3 event
    const event: S3Event = {
      Records: [{
        s3: {
          bucket: {
            name: 'test-bucket'
          },
          object: {
            key: 'uploaded/test.csv'
          }
        }
      }]
    } as any;

    const response = await importFileParser(event);
    expect(response.statusCode).toBe(200);
  });

  it('should skip files not in uploaded folder', async () => {
    const event: S3Event = {
      Records: [{
        s3: {
          bucket: {
            name: 'test-bucket'
          },
          object: {
            key: 'parsed/test.csv'
          }
        }
      }]
    } as any;

    const response = await importFileParser(event);

    expect(response.statusCode).toBe(200);
    expect(s3Mock.calls()).toHaveLength(0);
  });

  it('should handle empty file body', async () => {
    s3Mock.on(GetObjectCommand).resolves({
      Body: undefined,
      $metadata: { httpStatusCode: 200 }
    });

    const event: S3Event = {
      Records: [{
        s3: {
          bucket: {
            name: 'test-bucket'
          },
          object: {
            key: 'uploaded/test.csv'
          }
        }
      }]
    } as any;

    await expect(importFileParser(event)).rejects.toThrow('Empty file body');
  });

  it('should handle S3 errors', async () => {
    s3Mock.on(GetObjectCommand).rejects(new Error('S3 Error'));

    const event: S3Event = {
      Records: [{
        s3: {
          bucket: {
            name: 'test-bucket'
          },
          object: {
            key: 'uploaded/test.csv'
          }
        }
      }]
    } as any;

    await expect(importFileParser(event)).rejects.toThrow('S3 Error');
  });

  it('should handle CSV parsing errors', async () => {
    const mockInvalidCsvData = 'invalid,csv\ndata';
    const mockStream = sdkStreamMixin(Readable.from([mockInvalidCsvData]));

    s3Mock.on(GetObjectCommand).resolves({
      Body: mockStream,
      $metadata: { httpStatusCode: 200 }
    });

    const event: S3Event = {
      Records: [{
        s3: {
          bucket: {
            name: 'test-bucket'
          },
          object: {
            key: 'uploaded/test.csv'
          }
        }
      }]
    } as any;

    const response = await importFileParser(event);
    expect(response.statusCode).toBe(200);
  });

  it('should process multiple records', async () => {
    const mockCsvData = 'id,title\n1,Product 1';
    const mockStream = sdkStreamMixin(Readable.from([mockCsvData]));

    s3Mock.on(GetObjectCommand).resolves({
      Body: mockStream,
      $metadata: { httpStatusCode: 200 }
    });

    const event: S3Event = {
      Records: [
        {
          s3: {
            bucket: { name: 'test-bucket' },
            object: { key: 'uploaded/test1.csv' }
          }
        },
        {
          s3: {
            bucket: { name: 'test-bucket' },
            object: { key: 'uploaded/test2.csv' }
          }
        }
      ]
    } as any;

    const response = await importFileParser(event);

    expect(response.statusCode).toBe(200);
    expect(s3Mock.calls().filter(call => call.args[0] instanceof GetObjectCommand)).toHaveLength(2);
  });
});
