import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity'
import { CognitoIdentityClient } from '@aws-sdk/client-cognito-identity'
import { AWS_REGION, IDENTITY_POOL_ID, S3_BUCKET } from './config'

let client = null

function getClient() {
  if (!client) {
    client = new S3Client({
      region: AWS_REGION,
      credentials: fromCognitoIdentityPool({
        client: new CognitoIdentityClient({ region: AWS_REGION }),
        identityPoolId: IDENTITY_POOL_ID,
      }),
    })
  }
  return client
}

function base64ToUint8Array(dataUrl) {
  const base64 = dataUrl.split(',')[1]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

const MIME_TYPES = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

export async function uploadImage(base64DataUrl, format, userHash) {
  const bytes = base64ToUint8Array(base64DataUrl)
  const dateKey = new Date().toISOString().split('T')[0]
  const imageId = crypto.randomUUID()
  const s3Key = `images/${userHash}/${dateKey}/${imageId}.${format}`

  await getClient().send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: bytes,
    ContentType: MIME_TYPES[format] || 'image/png',
  }))

  return { s3Key, imageId }
}

export async function getImageUrl(s3Key) {
  const response = await getClient().send(new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
  }))

  const blob = await new Response(response.Body).blob()
  return URL.createObjectURL(blob)
}
