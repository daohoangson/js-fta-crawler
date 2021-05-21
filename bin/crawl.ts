import { createArrayCsvWriter } from 'csv-writer'
import fs from 'fs'

import { headers, loop } from '../src/fta'

const csv = createArrayCsvWriter({
  path: 'result.csv',
  header: headers
})
const source = JSON.parse(fs.readFileSync('./source.json').toString('utf8'))
loop(source, async (values) => await csv.writeRecords([values])).then(
  (_) => { },
  (_) => { }
)
