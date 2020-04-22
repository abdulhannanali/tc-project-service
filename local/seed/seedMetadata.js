const _ = require('lodash')
const axios = require('axios');
const Promise = require('bluebird');

if (!process.env.CONNECT_USER_TOKEN) {
  console.error('This script requires environment variable CONNECT_USER_TOKEN to be defined. Login to http://connect.topcoder-dev.com and get your user token from the requests headers.')
  process.exit(1);
}

// we need to know any logged in Connect user token to retrieve data from DEV
const CONNECT_USER_TOKEN = process.env.CONNECT_USER_TOKEN;

var url = 'https://api.topcoder-dev.com/v5/projects/metadata';

module.exports = (targetUrl, token) => {
  var destUrl = targetUrl + 'projects/';
  var destTimelines = targetUrl;

  console.log('Getting metadata from DEV environment...');
  return axios.get(url, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONNECT_USER_TOKEN}`
    }
  })
  .catch((err) => {
    const errMessage = _.get(err, 'response.data.message');
    throw errMessage ? new Error('Error during obtaining data from DEV: ' + errMessage) : err
  })
  .then(async function (response) {
    let data = response.data;

    console.log('Creating metadata objects locally...');

    var headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    }

    let promises

    promises = _(data.forms).orderBy(['key', 'asc'], ['version', 'asc']).map(pt=>{
      const param = _.omit(pt, ['id', 'version', 'revision', 'key']);
      return axios
        .post(destUrl + `metadata/form/${pt.key}/versions`, param, {headers:headers})
        .catch((err) => {
          const errMessage = _.get(err, 'response.data.message', '');
          console.log(`Failed to create form with key=${pt.key} version=${pt.version}.`, errMessage)
        })
    });

    await Promise.all(promises);

    promises = _(data.planConfigs).orderBy(['key', 'asc'], ['version', 'asc']).map(pt=>{
      const param = _.omit(pt, ['id', 'version', 'revision', 'key']);
      return axios
        .post(destUrl + `metadata/planConfig/${pt.key}/versions`, param, {headers:headers})
        .catch((err) => {
          const errMessage = _.get(err, 'response.data.message', '');
          console.log(`Failed to create planConfig with key=${pt.key} version=${pt.version}.`, errMessage)
        })
    });

    await Promise.all(promises);

    promises = _(data.priceConfigs).orderBy(['key', 'asc'], ['version', 'asc']).map(pt=>{
      const param = _.omit(pt, ['id', 'version', 'revision', 'key']);
      return axios
        .post(destUrl + `metadata/priceConfig/${pt.key}/versions`, param, {headers:headers})
        .catch((err) => {
          const errMessage = _.get(err, 'response.data.message', '');
          console.log(`Failed to create priceConfig with key=${pt.key} version=${pt.version}.`, errMessage)
        })
    });

    await Promise.all(promises);

    promises = _(data.projectTypes).map(pt=>{
      return axios
        .post(destUrl+'metadata/projectTypes', pt, {headers:headers})
        .catch((err) => {
          const errMessage = _.get(err, 'response.data.message', '');
          console.log(`Failed to create projectType with key=${pt.key}.`, errMessage)
        })
    });

    await Promise.all(promises);

    promises = _(data.productCategories).map(pt=>{
      return axios
        .post(destUrl+'metadata/productCategories', pt, {headers:headers})
        .catch((err) => {
          const errMessage = _.get(err, 'response.data.message', '');
          console.log(`Failed to create productCategory with key=${pt.key}.`, errMessage)
        })
    });

    await Promise.all(promises);

    promises = _(data.projectTemplates).map(pt=>{
      return axios
        .post(destUrl+'metadata/projectTemplates', pt, {headers:headers})
        .catch((err) => {
          const errMessage = _.get(err, 'response.data.message', '');
          console.log(`Failed to create projectTemplate with id=${pt.id}.`, errMessage)
        })
    });

    await Promise.all(promises);

    promises = _(data.productTemplates).map(pt=>{
      return axios
        .post(destUrl+'metadata/productTemplates', pt, {headers:headers})
        .catch((err) => {
          const errMessage = _.get(err, 'response.data.message', '');
          console.log(`Failed to create productTemplate with id=${pt.id}.`, errMessage)
        })
    });

    await Promise.all(promises);

    await Promise.each(data.milestoneTemplates,pt=> (
      axios
        .post(destTimelines+'timelines/metadata/milestoneTemplates', pt, {headers:headers})
        .catch((err) => {
          const errMessage = _.get(err, 'response.data.message', '');
          console.log(`Failed to create milestoneTemplate with id=${pt.id}.`, errMessage)
        })
    ));

    // handle success
    console.log('Done metadata seed');
  }).catch(err=>{
    console.error(err && err.response ? err.response : err);
  });
}
