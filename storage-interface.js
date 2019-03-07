
const bcrypt = require('bcryptjs');
const fs = require('fs');
const AWS = require('aws-sdk');
const { DateTime } = require("luxon");

const dynamoDb = new AWS.DynamoDB.DocumentClient();

class StorageInterface {

  async registerNewDevice(deviceId, apiKey) {
    let salt = await bcrypt.genSalt(10);

    const params = {
      TableName: process.env.DEVICES_TABLE_NAME,
      Item: {
        deviceId,
        hashedApiKey: await bcrypt.hash(apiKey, salt),
        created: DateTime.utc().toISO()
      }
    };

    await dynamoDb.put(params).promise();
  }

  async getDeviceDetails(deviceId) {
    const params = {
      TableName: process.env.DEVICES_TABLE_NAME,
      Key: {
        deviceId: deviceId
      }
    };

    let response = await dynamoDb.get(params).promise();

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
        expires: expires.toISO(),
        created: DateTime.utc().toISO()
      }
    };

    await dynamoDb.put(params).promise();
  }

  async registerNewUser(userId, dropboxAccountId, dropboxAccessToken) {
    const params = {
      TableName: process.env.USERS_TABLE_NAME,
      Item: {
        userId,
        dropboxAccountId,
        dropboxAccessToken
      }
    };

    await dynamoDb.put(params).promise();
  }
}

module.exports = StorageInterface;
