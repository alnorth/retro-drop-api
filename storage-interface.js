
const bcrypt = require('bcryptjs');
const fs = require('fs');
const AWS = require('aws-sdk');
const { DateTime } = require("luxon");
const shortid = require('shortid');

const ddb = new AWS.DynamoDB.DocumentClient();

class StorageInterface {

  async registerNewDevice(deviceId, apiKey) {
    let salt = await bcrypt.genSalt(10);

    const params = {
      TableName: process.env.DEVICES_TABLE_NAME,
      Item: {
        deviceId,
        hashedApiKey: await bcrypt.hash(apiKey, salt),
        created: epochTime()
      }
    };

    await ddb.put(params).promise();
  }

  async getDeviceDetails(deviceId) {
    const params = {
      TableName: process.env.DEVICES_TABLE_NAME,
      Key: {
        deviceId: deviceId
      }
    };

    let response = await ddb.get(params).promise();

    return response.Item || false;
  }

  async isApiKeyValid(storedHash, apiKey) {
    return await bcrypt.compare(apiKey, storedHash);
  }

  async storeConnectionToken(deviceId, connectionToken, expires) {
    const params = {
      TableName: process.env.CONNECTION_TOKENS_TABLE_NAME,
      Item: {
        connectionToken,
        deviceId,
        expires: epochTime(expires),
        created: epochTime()
      }
    };

    await ddb.put(params).promise();
  }

  async userFromDropboxDetails(dropboxAccountId, dropboxAccessToken) {
    // First check if this user exists already.

    let existingUserResult = await ddb.query({
      ExpressionAttributeValues: {
        ':dropboxAccountId' : dropboxAccountId
      },
      KeyConditionExpression: 'dropboxAccountId = :dropboxAccountId',
      ProjectionExpression: 'userId',
      TableName: process.env.USERS_TABLE_NAME,
      IndexName: 'by-dropbox-id',
      Limit: 1
    }).promise();

    let existingUserFound = existingUserResult.Items.length === 1;
    let userId = existingUserFound ? existingUserResult.Items[0].userId : shortid.generate();

    if (existingUserFound) {
      // The access token will have changed, so we might as well update it.
      await ddb.update({
        TableName: process.env.USERS_TABLE_NAME,
        Key: { userId },
        UpdateExpression: 'set dropboxAccessToken = :t, updated = :u',
        ExpressionAttributeValues: {
          ':t' : dropboxAccessToken,
          ':u' : epochTime()
        }
      }).promise();
    } else {
      await ddb.put({
        TableName: process.env.USERS_TABLE_NAME,
        Item: {
          userId,
          dropboxAccountId,
          dropboxAccessToken,
          created: epochTime(),
          updated: epochTime()
        }
      }).promise();
    }

    return userId;
  }
}

module.exports = StorageInterface;

// ---

function epochTime(luxonObj = DateTime.utc()) {
  return Math.round(luxonObj.toSeconds());
}
