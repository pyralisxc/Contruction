import assert from 'assert'

async function run() {
  const payload = { items: [{ sku: '058449', quantity: 2 }, { sku: '603682', quantity: 1 }] }
  const url = 'http://localhost:3002/api/store/cart'
  const maxAttempts = 30
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        console.warn(`server responded ${res.status}: ${text}`)
        // retry on transient errors
        await new Promise((r) => setTimeout(r, 500))
        continue
      }
      const json = await res.json()
      console.log('cart response:', JSON.stringify(json, null, 2))
      assert(json && json.cart, 'expected cart in response')
      process.exit(0)
    } catch (err) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  console.error('failed to contact server at', url)
  process.exit(1)
}

run().catch((err) => { console.error(err); process.exit(1) })
