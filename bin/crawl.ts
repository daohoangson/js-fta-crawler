import yargs from 'yargs'

import { Direction, start } from '../src/fta'
import { write } from '../src/io'

async function startCsv (dir: Direction, country: string | number): Promise<void> {
  const result = await start(dir, country)
  await write(dir, country, result)
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
