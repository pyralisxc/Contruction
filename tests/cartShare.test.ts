import assert from 'assert'

async function run() {
  const payload = { items: [{ sku: '058449', quantity: 2 }, { sku: '603682', quantity: 1 }] }
  const postUrl = 'http://localhost:3002/api/store/cart/share'
  const maxAttempts = 30
  let shareResp: any = null
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(postUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      if (!res.ok) {
        await new Promise((r) => setTimeout(r, 500))
        continue
      }
      shareResp = await res.json()
      break
    } catch (err) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  if (!shareResp) {
    console.error('failed to get share response from', postUrl)
    process.exit(1)
  }
  console.log('share response:', JSON.stringify(shareResp, null, 2))
  assert(shareResp.id, 'expected id')
  assert(shareResp.shortUrl, 'expected shortUrl')

  // fetch the short URL HTML (friendly)
  const shortUrl = shareResp.shortUrl.startsWith('http') ? shareResp.shortUrl : `http://localhost:3002${shareResp.shortUrl}`
  const htmlRes = await fetch(shortUrl)
  assert(htmlRes.ok, 'expected ok html response')
  const text = await htmlRes.text()
  console.log('html length', text.length)
  assert(text.includes('Shareable Cart'), 'expected page title')
  
  // Revoke the share and ensure the short URL no longer resolves
  const deleteRes = await fetch(`http://localhost:3002/api/store/cart/share/${shareResp.id}`, { method: 'DELETE' })
  assert(deleteRes.ok, 'expected delete ok')
  const after = await fetch(shortUrl)
  assert(after.status === 404, 'expected 404 after revoke')
  process.exit(0)
}

run().catch((err) => { console.error(err); process.exit(1) })
