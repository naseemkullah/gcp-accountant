import * as inquirer from 'inquirer';

import {BigQuery} from '@google-cloud/bigquery';

export interface Answers {
  dataset: string;
  table: string;
  month: string;
}

export default async () => {
  const bigquery = new BigQuery();

  return inquirer.prompt<Answers>([
    {
      name: 'dataset',
      type: 'list',
      message: 'What is the billing dataset called?',
      choices: await bigquery
        .getDatasets()
        .then(([datasets]) => datasets.map(ds => ds.id)),
    },
    {
      name: 'table',
      type: 'list',
      message: 'What is the billing table called?',
      choices: async ({dataset}) =>
        bigquery
          .dataset(dataset)
          .getTables()
          .then(([tables]) => tables.map(t => t.id)),
    },
    {
      name: 'month',
      type: 'input',
      message: 'For which invoice month?',
      default: new Date().toISOString().slice(0, 7).replace('-', ''),
    },
  ]);
};

new Date().toISOString();
