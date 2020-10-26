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
    const location = agent.parameters.location;
    const query = `SELECT count(distinct listing_url) as cnt FROM \`natural-byway-293514.airbnb.airbnb_listing\` where neighbourhood_group_cleansed like '%${location}%'`;
    const rows = await getData(query);
    const cnt = rows[0].cnt;
    agent.add(`${cnt} hosts are found with location as ${location}!\nMay I know what how many people do you have?`);
  }

  async function getPax(agent) {
    const location = agent.context.get('location').parameters.location;
    const pax = agent.parameters.pax;
    const query = `SELECT count(distinct listing_url) as cnt FROM \`natural-byway-293514.airbnb.airbnb_listing\` where neighbourhood_group_cleansed like '%${location}%' and accommodates <= ${pax}`;
    const rows = await getData(query);
    const cnt = rows[0].cnt;
    agent.add(`${cnt} hosts are found with location as ${location} that can accommodate for ${pax}!\nMay I know what is your budget?`);
  }

  async function getBudget(agent) {
    const location = agent.context.get('location').parameters.location;
    const pax = agent.context.get('pax').parameters.pax;
    const budget_amt = agent.parameters.budget.amount;
    const budget_currenty = agent.parameters.budget.currency;
    const query = `SELECT count(distinct listing_url) as cnt FROM \`natural-byway-293514.airbnb.airbnb_listing\` where neighbourhood_group_cleansed like '%${location}%' and accommodates <= ${pax} and price <= ${budget_amt}`;
    const rows = await getData(query);
    const cnt = rows[0].cnt;

    const query2 = `SELECT distinct listing_url FROM \`natural-byway-293514.airbnb.airbnb_listing\` where neighbourhood_group_cleansed like '%${location}%' and accommodates <= ${pax} and price <= ${budget_amt} limit 5`;
    const rows2 = await getData(query2);
    console.log(rows2)
    var cnt2 = rows2.length;
    if (cnt2 > 5) {
      cnt2 = 5;
    }
    var lst = "";
    for (var row of rows2) {
      lst = lst + row.listing_url + "\n";
    }
    agent.add(`${cnt} hosts are found with location as ${location} that can accommodate for ${pax} with price no more than ${budget_amt}${budget_currenty}!\nHere is your top ${cnt2} recommendations:\n${lst}`);
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
  intentMap.set('ask_location', getLocation);
  intentMap.set('ask_pax', getPax);
  intentMap.set('ask_budget', getBudget);
  agent.handleRequest(intentMap);
});

