const express = require('express');
const crypto = require('crypto');
const querystring = require('querystring');
const { DateTime } = require("luxon");
const serverless = require('serverless-http');
const shortid = require('shortid');
const uuidAPIKey = require('uuid-apikey');
const fetch = require('isomorphic-fetch');
const Dropbox = require('dropbox').Dropbox;
const StorageInterface = require('./storage-interface');

const app = express();
const storage = new StorageInterface();
const dbx = new Dropbox({
  fetch: fetch,
  clientId: process.env.DROPBOX_APP_KEY,
  clientSecret: process.env.DROPBOX_APP_SECRET
});
const dropboxRedirectUrl = `https://${process.env.DOMAIN_NAME}/dropbox/oauth/return`;

// Following https://serverless.com/blog/serverless-express-rest-api/.

app.get('/dropbox/oauth/signup-url', function (req, res) {
  let url = dbx.getAuthenticationUrl(dropboxRedirectUrl, null, 'code');

  res.send({ url });
});

app.get('/dropbox/oauth/return', async function (req, res) {
  let code = req.query.code;

  let accessToken = await dbx.getAccessTokenFromCode(dropboxRedirectUrl, req.query.code);

  let userDbx = new Dropbox({ fetch, accessToken });
  let dropboxUser = await userDbx.usersGetCurrentAccount();

  let userId = await storage.userFromDropboxDetails(dropboxUser.account_id, accessToken);

  res.send({ userId, dropboxUser });
});

app.post('/device', async function (req, res) {
  let deviceId = shortid.generate();
  let apiKey = uuidAPIKey.create().apiKey;
  // We don't want lots of unconnected devices hanging around in our database. They can always
  // request a new ID and API key.
  let expires = DateTime.utc().plus({ days: 5 });

  await storage.registerNewDevice(deviceId, apiKey, expires);

  res.send({
    deviceId,
    apiKey
  });
});

let deviceRouter = express.Router({ mergeParams: true });

deviceRouter.use(async function (req, res, next) {
  let deviceId = req.params.deviceId;
  let device = await storage.getDeviceDetails(deviceId);
  if (!device) {
    res.status(404).send({ error: 'Device does not exist.' });
  } else if (!req.header('Authorization')) {
    res.status(401).send({ error: 'No Authorization header was supplied.' });
  } else if (!await storage.isApiKeyValid(device.hashedApiKey, req.header('Authorization').slice(7))) {
    res.status(401).send({ error: 'The provided API key was not valid.' });
  } else {
    res.locals.device = device;
    next();
  }
});

deviceRouter.get('/connection-token', async function (req, res) {
  let connectionToken = crypto.randomBytes(4).toString('hex').toUpperCase();
  let expires = DateTime.utc().plus({ hours: 2 });

  await storage.storeConnectionToken(req.params.deviceId, connectionToken, expires);

  res.send({
    connectionToken,
    expires
  });
});

deviceRouter.get('/details', async function (req, res) {
  if (res.locals.device.details) {
    res.send(res.locals.device.details);  
  } else {
    res.status(404).send({ error: 'Device has not yet been connected.' });
  }
});

app.use('/device/:deviceId', deviceRouter);

module.exports.handler = serverless(app);