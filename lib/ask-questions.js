const inquirer = require('inquirer');

const { BigQuery } = require('@google-cloud/bigquery');

const d = new Date();
/*
  JS numbers months from 0-11, while GCP billing uses the normal 1-12,
  therefore the default value is _last_ month.
*/
const currentInvoiceMonth = d.getFullYear().toString() * 100 + d.getMonth();
module.exports = async () => {
  const bigquery = new BigQuery();

  const questions = [
    {
      name: 'dataset',
      type: 'list',
      message: 'What is the billing dataset called?',
      choices: await bigquery.getDatasets()
        .then(([datasets]) => datasets.map(ds => ds.id)),
    },
    {
      name: 'table',
      type: 'list',
      message: 'What is the billing table called?',
      choices: async answers => bigquery.dataset(answers.dataset).getTables()
        .then(([tables]) => tables.map(t => t.id)),
    },
    // {
    //   name: 'gkeUsageMetering',
    //   type: 'confirm',
    //   message: 'Is GKE usage metering enabled?',
    //   default: false,
    // },
    // {
    //   name: 'usageMeteringdataset',
    //   type: 'list',
    //   message: 'What is the usage metering dataset called?',
    //   choices: await bigquery.getDatasets()
    //     .then(([datasets]) => datasets.map(ds => ds.id)),
    //   when(answers) {
    //     return answers.gkeUsageMetering === true;
    //   },
    // },
    {
      name: 'month',
      type: 'input',
      message: 'For which invoice month?',
      default: currentInvoiceMonth,
    },
  ];
  return inquirer.prompt(questions);
};
