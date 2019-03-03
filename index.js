const express = require('express');
const crypto = require('crypto');
const moment = require('moment');
const serverless = require('serverless-http');
const shortid = require('shortid');
const uuidAPIKey = require('uuid-apikey');
const StorageInterface = require('./storage-interface');

const app = express();
const storage = new StorageInterface();
require('dotenv').config();

// Following https://serverless.com/blog/serverless-express-rest-api/.

app.post('/device', async function (req, res) {
  let deviceId = shortid.generate();
  let apiKey = uuidAPIKey.create().apiKey;

  await storage.registerNewDevice(deviceId, apiKey);

  res.send({
    deviceId,
    apiKey
  });
});

let deviceRouter = express.Router({ mergeParams: true });

deviceRouter.use(async function (req, res, next) {
  let deviceId = req.params.deviceId;
  if (!await storage.isDeviceIdValid(deviceId)) {
    res.status(404).send({ error: 'Device does not exist.' });
  } else if (!req.header('Authorization')) {
    res.status(401).send({ error: 'No Authorization header was supplied.' });
  } else if (!await storage.isApiKeyValid(deviceId, req.header('Authorization').slice(7))) {
    res.status(401).send({ error: 'The provided API key was not valid.' });
  } else {
    next();
  }
});

deviceRouter.get('/connection-token', async function (req, res) {
  let connectionToken = crypto.randomBytes(4).toString('hex').toUpperCase();
  let expires = moment().add(2, 'hours');

  await storage.storeConnectionToken(req.params.deviceId, connectionToken, expires);

  res.send({
    connectionToken,
    expires
  });
});

deviceRouter.get('/details', async function (req, res) {
  let details = await storage.getDeviceDetails(req.params.deviceId);

  if (details) {
    res.send(details);  
  } else {
    res.status(404).send({ error: 'Device has not yet been connected.' });
  }
});

app.use('/device/:deviceId', deviceRouter);

if (process.env.NODE_ENV === 'development') {
  app.listen(3001);
}
module.exports.handler = serverless(app);