import { createArrayCsvWriter } from 'csv-writer'
import yargs from 'yargs'

import { Direction, headers, start } from '../src/fta'
import { log } from '../src/io'

async function startCsv (dir: Direction, country: string | number): Promise<void> {
  const path = `${country}-${dir}.csv`
  const csv = createArrayCsvWriter({
    path,
    header: headers
  })

  await start(dir, country, async (values) => await csv.writeRecords([values]))
  log(`Write to ${path} ok`)
}

Promise.resolve(
  yargs
    .option('export', {
      alias: 'e',
      description: 'Process export data',
      type: 'boolean'
    })
    .option('import', {
      alias: 'i',
      description: 'Process import data',
      type: 'boolean'
    })
    .help().alias('help', 'h')
    .argv
).then(
  async (argv) => {
    for (const country of argv._) {
      if (argv.export === true) {
        await startCsv('out', country)
      }

      if (argv.import === true) {
        await startCsv('in', country)
      }
    }
  },
  (e) => console.error(e)
)
