'use strict';

const functions = require('firebase-functions');
const { WebhookClient } = require('dialogflow-fulfillment');
const { Card, Suggestion } = require('dialogflow-fulfillment');
const { BigQuery } = require('@google-cloud/bigquery');
const bigquery = new BigQuery();

process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements

exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
  const agent = new WebhookClient({ request, response });
  console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body));

  function welcome(agent) {
    agent.add(`Welcome to my agent!`);
  }

  function fallback(agent) {
    agent.add(`I didn't understand`);
    agent.add(`I'm sorry, can you try again?`);
  }
  
  async function getLocation(agent) {
    const query = 'SELECT listing_url FROM `natural-byway-293514.airbnb.airbnb_listing` LIMIT 10';
    const rows = await getData(query);
    agent.add(`${rows[0].listing_url}`);
  }

  async function getData(query) {
    const bigquery = new BigQuery({
      projectId: `natural-byway-293514`
    });

    const options = {
      query: query,
      location: 'US',
    };

    const [rows] = await bigquery.query(options);

    console.log('Rows:');
    rows.forEach(row => console.log(row));
    return rows;
  }

  let intentMap = new Map();
  intentMap.set('Default Welcome Intent', welcome);
  intentMap.set('Default Fallback Intent', fallback);
  intentMap.set('location', getLocation);
  agent.handleRequest(intentMap);
});

