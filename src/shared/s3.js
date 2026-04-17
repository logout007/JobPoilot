// ── S3 upload helper
// Generic upload utility for the jobpilot S3 bucket.
// Never throws — returns empty string on failure.

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const BUCKET = process.env.S3_BUCKET || 'jobpilot-v2-data';
const REGION = 'ap-south-1';

const s3 = new S3Client({ region: REGION });

/**
 * Uploads a buffer to S3 with public-read ACL.
 * @param {Buffer} buffer - The file content.
 * @param {string} key - The S3 object key (path).
 * @param {string} contentType - The MIME content type.
 * @returns {Promise<string>} The public S3 URL, or '' on failure.
 */
export async function uploadToS3(buffer, key, contentType) {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await s3.send(command);
    return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
  } catch (error) {
    console.error(`[S3] Failed to upload "${key}":`, error.message);
    return '';
  }
}
