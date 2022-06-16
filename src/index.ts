#!/usr/bin/env node

import {exit} from 'process';
import askQuestions from './ask-questions';
import * as queries from './queries';

/*
 * ^         Start of string
 * [a-z0-9]  a or b or c or ... z or 0 or 1 or ... 9 or _
 * +         one or more times (change to * to allow empty string)
 * $         end of string
 * /i        case-insensitive
 */
const regex = RegExp(/^[a-z0-9_]+$/i);

(async () => {
  const answers = await askQuestions();
  // ensure no funny business with regards to dataset and table names
  if (!regex.test(answers.dataset) || !regex.test(answers.table)) {
    console.error(
      'Character detected that is not a letter (upper or lower case), number, or underscore'
    );
    exit(1);
  }

  queries.service(answers);
  queries.compute(answers);
  queries.storage(answers);
  queries.gkeVsNonGkeCompute(answers);
  queries.network(answers);
  queries.preemptible(answers);
  queries.nonPreemptible(answers);
})();
