# gcp-accountant

           /:""|
          |:`66|_
          C`    _)
           \ ._|
            ) /
           /`\\
          || |Y|
          || |#|
          || |#|
          || |#|
          :| |=:
          ||_|,|
          \)))||
       |~~~`-`~~~|
       |         |
       |_________|
       |_________|
           | ||
           |_||__
      jgs  (____))

A tool to identify high cost resources in GCP at a granular level

## Prerequisites

* You must have [Billing export for BigQuery](https://cloud.google.com/billing/docs/how-to/export-data-bigquery) enabled

* You must be authorized to create BigQuery jobs

* It is highly recommended that resources be labelled at a granular level. The granularity of the labels will be reflected in the results.

## How it works

First, `gcp-accountant` makes use of [inquirer](https://www.npmjs.com/package/inquirer) and the [Google BigQuery Client Library for Node.js](https://www.npmjs.com/package/@google-cloud/bigquery) to gather some info from the user:
1. The name of the billing dataset
2. The name of the billing table
3. The invoice month to perform cost analysis on in `YYYYMM` format

Then `gcp-accountant` runs queries on the data by means of the aforementioned BigQuery client.

Finally, `gcp-account` displays the results in the terminal by means of [cliui](https://www.npmjs.com/package/cliui) and [chalk](https://www.npmjs.com/package/chalk).

## THIS IS NOT AN OFFICIAL GOOGLE PRODUCT
