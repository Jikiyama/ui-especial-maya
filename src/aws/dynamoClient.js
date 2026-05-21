import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity'
import { CognitoIdentityClient } from '@aws-sdk/client-cognito-identity'
import { AWS_REGION, IDENTITY_POOL_ID, DYNAMO_TABLE } from './config'

let docClient = null

function getClient() {
  if (!docClient) {
    const ddbClient = new DynamoDBClient({
      region: AWS_REGION,
      credentials: fromCognitoIdentityPool({
        client: new CognitoIdentityClient({ region: AWS_REGION }),
        identityPoolId: IDENTITY_POOL_ID,
      }),
    })
    docClient = DynamoDBDocumentClient.from(ddbClient)
  }
  return docClient
}

export async function saveImageMetadata({ userHash, dateKey, timestamp, imageId, s3Key, prompt, format, size, quality }) {
  await getClient().send(new PutCommand({
    TableName: DYNAMO_TABLE,
    Item: {
      userHash,
      sortKey: `${dateKey}#${timestamp}`,
      dateKey,
      imageId,
      s3Key,
      prompt,
      format,
      size,
      quality,
    },
  }))
}

export async function getImagesForDate(userHash, dateKey) {
  const result = await getClient().send(new QueryCommand({
    TableName: DYNAMO_TABLE,
    KeyConditionExpression: 'userHash = :uh AND begins_with(sortKey, :dk)',
    ExpressionAttributeValues: {
      ':uh': userHash,
      ':dk': `${dateKey}#`,
    },
    ScanIndexForward: false,
  }))
  return result.Items || []
}

export async function getAllDates(userHash) {
  const items = []
  let lastKey = undefined

  do {
    const result = await getClient().send(new QueryCommand({
      TableName: DYNAMO_TABLE,
      KeyConditionExpression: 'userHash = :uh',
      ExpressionAttributeValues: { ':uh': userHash },
      ProjectionExpression: 'dateKey',
      ExclusiveStartKey: lastKey,
    }))
    items.push(...(result.Items || []))
    lastKey = result.LastEvaluatedKey
  } while (lastKey)

  const unique = [...new Set(items.map(i => i.dateKey))]
  unique.sort((a, b) => b.localeCompare(a))
  return unique
}
