import assert from 'assert'
import HomeDepotAdapter from '../server/src/adapters/homedepotAdapter'

async function run() {
  process.env.HOMEDPOT_MODE = 'mock'
  const offers = await HomeDepotAdapter.search('2x6', { zipCode: '96813' })
  console.log('offers', offers && offers.length)
  assert(Array.isArray(offers), 'offers should be array')
  process.exit(0)
}

run().catch((err) => { console.error(err); process.exit(1) })
