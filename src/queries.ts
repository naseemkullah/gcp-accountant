import {BigQuery} from '@google-cloud/bigquery';
import * as chalk from 'chalk';
import {Answers} from './ask-questions';
const cliui = require('cliui');

const bigquery = new BigQuery();

const ui = cliui({});

interface Row {
  description: string;
  total_cost: string;
  currency: string;
  amount: string;
  unit: string;
  is_gke: string;
  service: string;
  sku: string;
  credit_name: string;
  credit_amount: string;
  labels: string;
}

export const storage = async (answers: Answers) => {
  const query = `
SELECT
  sku.description,
  ROUND(SUM(cost),2) AS total_cost,
  currency,
  TO_JSON_STRING(labels) AS labels
FROM
  \`${answers.dataset}.${answers.table}\`
WHERE
  service.description="Cloud Storage"
  AND invoice.month=@invoice_month
GROUP BY
  sku.description,
  currency,
  labels
HAVING
  total_cost <> 0
ORDER BY
  total_cost DESC
LIMIT
  10
  `;

  const rows = await getRows(query, answers.month);

  console.log(chalk.green('\nStorage costs:\n'));
  ui.div(
    {
      text: 'Description',
      border: true,
    },
    {
      text: 'Labels',
      border: true,
    },
    {
      text: chalk.yellow('Cost'),
      border: true,
    }
  );
  rows.forEach(row => {
    const labels = getLabels(row);

    ui.div(
      {text: row.description},
      {text: labels},
      {text: chalk.yellow(`${row.total_cost} ${row.currency}`)}
    );
  });
  console.log(ui.toString());
  ui.resetOutput();
};

export const service = async (answers: Answers) => {
  const query = `
SELECT
  service.description,
  (ROUND(SUM(cost) + SUM(IFNULL((
          SELECT
            SUM(c.amount)
          FROM
            UNNEST(credits) c),
          0)), 2)) AS total_cost,
  currency
FROM
  \`${answers.dataset}.${answers.table}\`
WHERE
  invoice.month=@invoice_month
GROUP BY
  service.description,
  currency
HAVING
  total_cost <> 0
ORDER BY
  total_cost DESC
  `;

  const rows = await getRows(query, answers.month);

  console.log(chalk.green('\nCost per service:\n'));
  rows.forEach(row => {
    console.log(
      `${row.description}: ${chalk.yellow(`${row.total_cost} ${row.currency}`)}`
    );
  });
};

export const compute = async (answers: Answers) => {
  const query = `
SELECT
  ROUND(SUM(cost) + SUM(IFNULL((
        SELECT
          SUM(c.amount)
        FROM
          UNNEST(credits) c),
        0)), 2) AS total_cost,
  currency,
  sku.description,
  TO_JSON_STRING(labels) AS labels,
  ROUND(SUM(usage.amount_in_pricing_units),2) AS amount,
  usage.pricing_unit AS unit
FROM
  \`${answers.dataset}.${answers.table}\`
WHERE
  invoice.month=@invoice_month
  AND service.description = 'Compute Engine'
GROUP BY
  currency,
  sku.description,
  labels,
  unit
HAVING
  total_cost > 100
ORDER BY
  total_cost DESC
  `;

  const rows = await getRows(query, answers.month);

  console.log(chalk.green('\nCompute costs:\n'));

  ui.div(
    {text: 'Description', border: true},
    {text: 'Labels', border: true},
    {text: 'Usage', border: true},
    {text: chalk.yellow('Cost'), border: true}
  );

  rows.forEach(row => {
    const labels = getLabels(row);

    ui.div(
      {text: row.description},
      {text: labels},
      {text: `${`${row.amount} ${row.unit}`}s`},
      {text: chalk.yellow(`${row.total_cost} ${row.currency}`)}
    );
  });
  console.log(ui.toString());
  ui.resetOutput();
};

export const gkeVsNonGkeCompute = async (answers: Answers) => {
  const query = `
SELECT
  (ROUND(SUM(cost) + SUM(IFNULL((
          SELECT
            SUM(c.amount)
          FROM
            UNNEST(credits) c),
          0)), 2)) AS total_cost,
  currency,
  'goog-gke-node' IN (
    SELECT
      key
    FROM
      UNNEST(labels))
    OR 'goog-gke-volume' IN (
    SELECT
      key
    FROM
      UNNEST(labels)) AS is_gke
FROM
  \`${answers.dataset}.${answers.table}\`
WHERE
  invoice.month=@invoice_month
  AND service.description='Compute Engine'
GROUP BY
  is_gke,
  currency
  `;

  const rows = await getRows(query, answers.month);

  console.log(chalk.green('\nGKE vs non-GKE node cost:\n'));
  ui.div(
    {
      text: 'GKE',
      border: true,
    },
    {
      text: chalk.yellow('Cost'),
      border: true,
    }
  );

  rows.forEach(row => {
    ui.div(
      {text: row.is_gke},
      // { text: `${`${row.amount} ${row.unit}`}s` },
      {text: chalk.yellow(`${row.total_cost} ${row.currency}`)}
    );
  });
  console.log(ui.toString());
  ui.resetOutput();
};

export const network = async (answers: Answers) => {
  const query = `
  SELECT
  service.description AS service,
  sku.description AS sku,
  TO_JSON_STRING(labels) AS labels,
  ROUND(SUM(cost),2) AS total_cost,
  currency
FROM
  \`${answers.dataset}.${answers.table}\`
WHERE
  invoice.month=@invoice_month
  AND sku.description LIKE '%Network%'
GROUP BY
  sku,
  service,
  labels,
  currency
HAVING
  total_cost > 100
ORDER BY
  total_cost DESC
  `;

  const rows = await getRows(query, answers.month);

  console.log(chalk.green('\nNetworking costs:\n'));
  ui.div(
    {text: 'Service', border: true},
    {text: 'Sku', border: true},
    {text: 'Labels', border: true},
    {text: chalk.yellow('cost'), border: true}
  );

  rows.forEach(row => {
    const labels = getLabels(row);

    ui.div(
      {text: row.service},
      {text: row.sku},
      {text: labels},
      {text: chalk.yellow(`${row.total_cost} ${row.currency}`)}
    );
  });
  console.log(ui.toString());
  ui.resetOutput();
};

export const preemptible = async (answers: Answers) => {
  const query = `
SELECT
  TO_JSON_STRING(labels) AS labels,
  ROUND(SUM(cost),2) AS total_cost,
  currency,
  sku.description,
  ROUND(SUM(usage.amount_in_pricing_units),2) AS amount,
  usage.pricing_unit AS unit
FROM
  \`${answers.dataset}.${answers.table}\`
WHERE
  invoice.month=@invoice_month
  AND sku.description LIKE '%Preemptible%'
GROUP BY
  labels,
  sku.description,
  currency,
  unit
HAVING
  total_cost > 100
ORDER BY
  total_cost DESC
  `;

  const rows = await getRows(query, answers.month);

  console.log(chalk.green('\nPreemptible compute costs:\n'));
  ui.div(
    {
      text: 'Description',
      border: true,
    },
    {
      text: 'Labels',
      border: true,
    },
    {
      text: 'Usage',
      border: true,
    },
    {
      text: chalk.yellow('Cost'),
      border: true,
    }
  );

  rows.forEach(row => {
    const labels = getLabels(row);

    ui.div(
      {text: row.description},
      {text: labels},
      {text: `${`${row.amount} ${row.unit}`}s`},
      {text: chalk.yellow(`${row.total_cost} ${row.currency}`)}
    );
  });
  console.log(ui.toString());
  ui.resetOutput();
};

export const nonPreemptible = async (answers: Answers) => {
  const query = `
SELECT
  TO_JSON_STRING(labels) AS labels,
  ROUND(SUM(cost),2) AS total_cost,
  currency,
  sku.description,
  ROUND(SUM(usage.amount_in_pricing_units),2) AS amount,
  usage.pricing_unit AS unit,
  ROUND(SUM(IFNULL(credits.amount,
        0)),2) AS credit_amount,
  IFNULL(credits.name,
    "") AS credit_name
FROM
  \`${answers.dataset}.${answers.table}\`
LEFT JOIN
  UNNEST(credits) AS credits
WHERE
  invoice.month=@invoice_month
  AND sku.description NOT LIKE '%Preemptible%'
  AND (sku.description LIKE '%Core%'
    OR sku.description LIKE '%Ram%'
    OR sku.description LIKE '%Cpu%')
GROUP BY
  labels,
  sku.description,
  currency,
  unit,
  credit_name
HAVING
  total_cost > 100
ORDER BY
  total_cost DESC
  `;

  const rows = await getRows(query, answers.month);

  console.log(chalk.green('\nNon-preemptible CPU/Ram costs:\n'));
  ui.div(
    {
      text: 'Description',
      border: true,
    },
    {
      text: 'Labels',
      border: true,
    },
    {
      text: 'Usage',
      border: true,
    },
    {
      text: chalk.yellow('Cost before credit'),
      border: true,
    },
    {
      text: 'Credit',
      border: true,
    },
    {
      text: chalk.yellow('Cost after credit'),
      border: true,
    }
  );

  rows.forEach(row => {
    const labels = getLabels(row);

    ui.div(
      {text: row.description},
      {text: labels},
      {text: `${`${row.amount} ${row.unit}`}s`},
      {text: chalk.yellow(`${row.total_cost} ${row.currency}`)},
      {
        text: chalk.green(
          `${row.credit_name}\n${row.credit_amount} ${row.currency}`
        ),
      },
      {
        text: chalk.yellow(
          `${(Number(row.total_cost) + Number(row.credit_amount)).toFixed(2)} ${
            row.currency
          }`
        ),
      }
    );
  });
  console.log(ui.toString());
  ui.resetOutput();
};

function getLabels(row: Row) {
  let labels = '';
  JSON.parse(row.labels).forEach((label: {key: string; value: string}) => {
    const {key} = label;
    const {value} = label;
    labels += `${key}: ${value}\n`;
  });
  return labels;
}

async function getRows(query: string, invoiceMonth: string) {
  const [rows] = await bigquery.query({
    query,
    params: {
      invoice_month: invoiceMonth,
    },
  });

  return rows as Row[];
}
