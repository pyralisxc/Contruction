import assert from 'assert'
import HomeDepotAdapter from '../server/src/adapters/homedepotAdapter'

async function run() {
  // Simulate local dev opt-in
  process.env.HOMEDPOT_MODE = 'unofficial'
  process.env.ALLOW_UNOFFICIAL = 'true'
  process.env.NODE_ENV = 'development'

  // Monkeypatch fetchJson to simulate robots blocking the external fetch
  const origFetch = (HomeDepotAdapter as any).fetchJson
  ;(HomeDepotAdapter as any).fetchJson = async function () {
    throw new Error('robots_disallowed:test')
  }

  try {
    const offers = await HomeDepotAdapter.search('2x4', { zipCode: '96813' })
    console.log('offers length', offers.length)
    assert(Array.isArray(offers), 'offers should be array')
    // When scraping is blocked we should get provider/mock offers, not unofficial scraped offers
    const hasUnofficial = offers.some((o: any) => typeof o.offerId === 'string' && o.offerId.startsWith('hd-unofficial'))
    assert(!hasUnofficial, 'expected fallback provider offers, not unofficial scraped offers')
  } finally {
    ;(HomeDepotAdapter as any).fetchJson = origFetch
  }

  process.exit(0)
}

run().catch((err) => { console.error(err); process.exit(1) })
