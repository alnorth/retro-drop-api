
const bcrypt = require('bcryptjs');
const fs = require('fs');
const moment = require('moment');

class StorageInterface {

  constructor() {
    // For now we just store things in memory. This won't do at all when we're live though. Switch to
    // SimpleDB when we have our AWS account back.
    try {
      this.data = require('./test-data.json');
    } catch (error) {
      this.data = {
        devices: {},
        connectionTokens: {}
      };
    }
  }

  async registerNewDevice(deviceId, apiKey) {
    let salt = await bcrypt.genSalt(10);

    this.data.devices[deviceId] = {
      hashedApiKey: await bcrypt.hash(apiKey, salt),
      created: moment()
    };
    this.saveData();
  }

  async isDeviceIdValid(deviceId) {
    return !!this.data.devices[deviceId];
  }

  async isApiKeyValid(deviceId, apiKey) {
    let storedHash = this.data.devices[deviceId].hashedApiKey;
    return await bcrypt.compare(apiKey, storedHash);
  }

  async storeConnectionToken(deviceId, connectionToken, expires) {
    this.data.connectionTokens[connectionToken] = {
      deviceId,
      expires,
      created: moment()
    };
    this.saveData();
  }

  async getDeviceDetails(deviceId) {
    if (this.data.devices[deviceId].details) {
      return this.data.devices[deviceId].details;
    } else {
      return false;
    }
  }

  saveData() {
    fs.writeFileSync('./test-data.json', JSON.stringify(this.data, true, 2));
  }

}

module.exports = StorageInterface;
