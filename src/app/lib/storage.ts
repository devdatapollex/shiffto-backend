import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import config from "../../config/index";

const endpoint = `https://${config.r2.account_id}.r2.cloudflarestorage.com`;

const publicClient = new S3Client({
  region: "auto",
  endpoint,
  credentials: {
    accessKeyId: config.r2.access_key_id,
    secretAccessKey: config.r2.secret_access_key,
  },
});

const privateClient = new S3Client({
  region: "auto",
  endpoint,
  credentials: {
    accessKeyId: config.r2.access_key_id,
    secretAccessKey: config.r2.secret_access_key,
  },
});

export async function uploadToPublicBucket(
  key: string,
  body: Uint8Array | Buffer | string,
  contentType: string,
) {
  await publicClient.send(
    new PutObjectCommand({
      Bucket: config.r2.public_bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return { key, url: `${config.r2.public_url}/${key}` };
}

export async function uploadToPrivateBucket(
  key: string,
  body: Uint8Array | Buffer | string,
  contentType: string,
) {
  await privateClient.send(
    new PutObjectCommand({
      Bucket: config.r2.private_bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  const command = new GetObjectCommand({
    Bucket: config.r2.private_bucket,
    Key: key,
  });
  const downloadUrl = await getSignedUrl(privateClient, command, {
    expiresIn: 3600,
  });
  return { key, downloadUrl };
}

export async function getPresignedUrl(key: string, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: config.r2.private_bucket,
    Key: key,
  });
  return getSignedUrl(privateClient, command, { expiresIn });
}

export async function deleteObject(key: string) {
  await privateClient.send(
    new DeleteObjectCommand({
      Bucket: config.r2.private_bucket,
      Key: key,
    }),
  );
}
