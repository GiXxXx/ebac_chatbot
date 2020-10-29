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
    const query = `SELECT count(distinct listing_url) as cnt FROM \`natural-byway-293514.airbnb.listings_with_aspect_score\` where neighbourhood_group_cleansed like '%${location}%'`;
    const rows = await getData(query);
    const cnt = rows[0].cnt;
    const response_str = `${cnt} hosts are found with location as ${location}! ` + '\n' + 'May I know what how many people do you have?';
    agent.add(`${response_str}`);
  }

  async function getPax(agent) {
    const location = agent.context.get('location').parameters.location;
    const pax = agent.parameters.pax;
    const query = `SELECT count(distinct listing_url) as cnt FROM \`natural-byway-293514.airbnb.listings_with_aspect_score\` where neighbourhood_group_cleansed like '%${location}%' and accommodates <= ${pax}`;
    const rows = await getData(query);
    const cnt = rows[0].cnt;
    const response_str = `${cnt} hosts are found with location as ${location} that can accommodate for ${pax}!` + '\n' + 'May I know what is your budget?';
    agent.add(`${response_str}`);
  }

  async function getBudget(agent) {
    const location = agent.context.get('location').parameters.location;
    const pax = agent.context.get('pax').parameters.pax;
    const budget_amt = agent.parameters.budget.amount;
    const budget_currenty = agent.parameters.budget.currency;
    const query = `SELECT count(distinct listing_url) as cnt FROM \`natural-byway-293514.airbnb.listings_with_aspect_score\` where neighbourhood_group_cleansed like '%${location}%' and accommodates <= ${pax} and price <= ${budget_amt}`;
    const rows = await getData(query);
    const cnt = rows[0].cnt;
    const response_str = `${cnt} hosts are found with location as ${location} that can accommodate for ${pax} with price no more than ${budget_amt}${budget_currenty}!` + '\n' + 'May I know which of following aspect is most important to you? \nnice host \nconvinient loation \ncleanliness, \ndelicious food, \nplentiful facilities';
    agent.add(`${response_str}`);

    // const query2 = `SELECT distinct listing_url FROM \`natural-byway-293514.airbnb.listings_with_aspect_score\` where neighbourhood_group_cleansed like '%${location}%' and accommodates <= ${pax} and price <= ${budget_amt} limit 5`;
    // const rows2 = await getData(query2);
    // console.log(rows2)
    // var cnt2 = rows2.length;
    // if (cnt2 > 5) {
    //   cnt2 = 5;
    // }
    // var lst = "";
    // for (var row of rows2) {
    //   lst = lst + row.listing_url + "\n";
    // }
    // const response_str = `${cnt} hosts are found with location as ${location} that can accommodate for ${pax} with price no more than ${budget_amt}${budget_currenty}!` + '\n' + `Here is your top ${cnt2} recommendations:` + '\n' + `${lst}`
    // agent.add(`${response_str}`);
  }

  async function getAspect(agent) {
    const location = agent.context.get('location').parameters.location;
    const pax = agent.context.get('pax').parameters.pax;
    const budget_amt = agent.context.get('budget').parameters.budget.amount;
    const budget_currenty = agent.context.get('budget').parameters.budget.currency;

    const aspect = agent.parameters.aspect[0].toLowerCase();

    var aspect_col = "host_score";
    if (aspect.includes("host")) {
      aspect_col = "host_score";
    } else if (aspect.includes("location")) {
      aspect_col = "location_score";
    } else if (aspect.includes("clean")) {
      aspect_col = "clean_score";
    } else if (aspect.includes("food")) {
      aspect_col = "food_score";
    } else if (aspect.includes("facility")) {
      aspect_col = "facility_score";
    }

    const query2 = `SELECT distinct listing_url, host_score, location_score, clean_score, food_score, facility_score  FROM \`natural-byway-293514.airbnb.listings_with_aspect_score\` where neighbourhood_group_cleansed like '%${location}%' and accommodates <= ${pax} and price <= ${budget_amt} order by ${aspect_col}`;
    const rows2 = await getData(query2);
    var cnt2 = rows2.length;
    if (cnt2 > 5) {
      cnt2 = 5;
    }
    var lst = "";
    var cnt = 0;
    for (var row of rows2) {
      lst = lst + row.listing_url + '(' + `host_rating: ${row.host_score}` + `location_rating: ${row.location_score}` + `clean_rating: ${row.clean_score}` + `food_rating: ${row.food_score}` + `facility_rating: ${row.facility_score}` + ')' + "\n";
      cnt = cnt + 1
      if (cnt == 5) {
        break;
      }
    }
    const response_str = `${rows2.length} hosts are found with location as ${location} that can accommodate for ${pax} with price no more than ${budget_amt}${budget_currenty}!` + '\n' + `Here is your top ${cnt2} recommendations:` + '\n' + `${lst}`;
    agent.add(`${response_str}`);
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
  intentMap.set('ask_aspect', getAspect);
  agent.handleRequest(intentMap);
});

