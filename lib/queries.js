const chalk = require('chalk');
const ui = require('cliui')();
const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery();

module.exports.storage = async (answers) => {
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

  const options = {
    query,
    // Location must match that of the dataset(s) referenced in the query.
    location: 'US',
    params: {
      invoice_month: answers.month.toString(),
    },
  };

  const [job] = await bigquery.createQueryJob(options);
  console.log(`Job ${job.id} started.`);

  const [rows] = await job.getQueryResults();

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
    },
  );
  rows.forEach((row) => {
    let labels = '';
    JSON.parse(row.labels).forEach((label) => {
      const { key } = label;
      const { value } = label;
      labels += `${key}: ${value}\n`;
    });

    ui.div(
      { text: row.description },
      { text: labels },
      { text: chalk.yellow(`${row.total_cost} ${row.currency}`) },
    );
  });
  console.log(ui.toString());
  ui.resetOutput();
};

module.exports.service = async (answers) => {
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

  const options = {
    query,
    // Location must match that of the dataset(s) referenced in the query.
    location: 'US',
    params: {
      invoice_month: answers.month.toString(),
    },
  };

  const [job] = await bigquery.createQueryJob(options);
  console.log(`Job ${job.id} started.`);

  const [rows] = await job.getQueryResults();

  console.log(chalk.green('\nCost per service:\n'));
  rows.forEach((row) => {
    console.log(
      `${row.description}: ${chalk.yellow(`${row.total_cost} ${row.currency}`)}`,
    );
  });
};

module.exports.compute = async (answers) => {
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

  const options = {
    query,
    // Location must match that of the dataset(s) referenced in the query.
    location: 'US',
    params: {
      invoice_month: answers.month.toString(),
    },
  };

  const [job] = await bigquery.createQueryJob(options);
  console.log(`Job ${job.id} started.`);

  const [rows] = await job.getQueryResults();

  console.log(chalk.green('\nCompute costs:\n'));

  ui.div(
    { text: 'Description', border: true },
    { text: 'Labels', border: true },
    { text: 'Usage', border: true },
    { text: chalk.yellow('Cost'), border: true },
  );

  rows.forEach((row) => {
    let labels = '';
    JSON.parse(row.labels).forEach((label) => {
      const { key } = label;
      const { value } = label;
      labels += `${key}: ${value}\n`;
    });

    ui.div(
      { text: row.description },
      { text: labels },
      { text: `${`${row.amount} ${row.unit}`}s` },
      { text: chalk.yellow(`${row.total_cost} ${row.currency}`) },
    );
  });
  console.log(ui.toString());
  ui.resetOutput();
};

module.exports.gkeVsNonGkeCompute = async (answers) => {
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

  const options = {
    query,
    // Location must match that of the dataset(s) referenced in the query.
    location: 'US',
    params: {
      invoice_month: answers.month.toString(),
    },
  };

  const [job] = await bigquery.createQueryJob(options);
  console.log(`Job ${job.id} started.`);

  const [rows] = await job.getQueryResults();

  console.log(chalk.green('\nGKE vs non-GKE node cost:\n'));
  ui.div(
    {
      text: 'GKE',
      border: true,
    },
    {
      text: chalk.yellow('Cost'),
      border: true,
    },
  );

  rows.forEach((row) => {
    ui.div(
      { text: row.is_gke },
      // { text: `${`${row.amount} ${row.unit}`}s` },
      { text: chalk.yellow(`${row.total_cost} ${row.currency}`) },
    );
  });
  console.log(ui.toString());
  ui.resetOutput();
};

module.exports.network = async (answers) => {
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

  const options = {
    query,
    // Location must match that of the dataset(s) referenced in the query.
    location: 'US',
    params: {
      invoice_month: answers.month.toString(),
    },
  };

  const [job] = await bigquery.createQueryJob(options);
  console.log(`Job ${job.id} started.`);

  const [rows] = await job.getQueryResults();

  console.log(chalk.green('\nNetworking costs:\n'));
  ui.div(
    { text: 'Service', border: true },
    { text: 'Sku', border: true },
    { text: 'Labels', border: true },
    { text: chalk.yellow('cost'), border: true },
  );

  rows.forEach((row) => {
    let labels = '';
    JSON.parse(row.labels).forEach((label) => {
      const { key } = label;
      const { value } = label;
      labels += `${key}: ${value}\n`;
    });

    ui.div(
      { text: row.service },
      { text: row.sku },
      { text: labels },
      { text: chalk.yellow(`${row.total_cost} ${row.currency}`) },
    );
  });
  console.log(ui.toString());
  ui.resetOutput();
};

module.exports.preemptible = async (answers) => {
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

  const options = {
    query,
    // Location must match that of the dataset(s) referenced in the query.
    location: 'US',
    params: {
      invoice_month: answers.month.toString(),
    },
  };

  const [job] = await bigquery.createQueryJob(options);
  console.log(`Job ${job.id} started.`);

  const [rows] = await job.getQueryResults();

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
    },
  );

  rows.forEach((row) => {
    let labels = '';
    JSON.parse(row.labels).forEach((label) => {
      const { key } = label;
      const { value } = label;
      labels += `${key}: ${value}\n`;
    });

    ui.div(
      { text: row.description },
      { text: labels },
      { text: `${`${row.amount} ${row.unit}`}s` },
      { text: chalk.yellow(`${row.total_cost} ${row.currency}`) },
    );
  });
  console.log(ui.toString());
  ui.resetOutput();
};

module.exports.nonPreemptible = async (answers) => {
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
  AND sku.description NOT LIKE '%Preemptible%'
  AND (sku.description LIKE '%Core%'
    OR sku.description LIKE '%Ram%'
    OR sku.description LIKE '%Cpu%')
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

  const options = {
    query,
    // Location must match that of the dataset(s) referenced in the query.
    location: 'US',
    params: {
      invoice_month: answers.month.toString(),
    },
  };

  const [job] = await bigquery.createQueryJob(options);
  console.log(`Job ${job.id} started.`);

  const [rows] = await job.getQueryResults();

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
      text: chalk.yellow('Cost'),
      border: true,
    },
  );

  rows.forEach((row) => {
    let labels = '';
    JSON.parse(row.labels).forEach((label) => {
      const { key } = label;
      const { value } = label;
      labels += `${key}: ${value}\n`;
    });

    ui.div(
      { text: row.description },
      { text: labels },
      { text: `${`${row.amount} ${row.unit}`}s` },
      { text: chalk.yellow(`${row.total_cost} ${row.currency}`) },
    );
  });
  console.log(ui.toString());
  ui.resetOutput();
};
