import { useEffect, useRef, useState } from 'react'
import { ProjectDocument } from '../../bim/types'
import useBimProjectStore from '../../stores/bimProjectStore'
import { StoredProjectSummary } from '../projectIO'
import { WorkspaceMode } from '../types'
import { Icon } from '../ui/Icons'

const workspaceModes: Array<{ id: WorkspaceMode; label: string; icon: Parameters<typeof Icon>[0]['name'] }> = [
  { id: 'plan2d', label: '2D Plan', icon: 'grid' },
  { id: 'framing3d', label: '3D Framing', icon: 'cube' },
  { id: 'split', label: 'Split', icon: 'panel' },
  { id: 'sheets', label: 'Sheets', icon: 'copy' },
  { id: 'materials', label: 'Materials', icon: 'cart' },
  { id: 'code', label: 'Code', icon: 'code' },
]

export function TopCommandBar({
  project,
  onBlueprint,
  onExportCsv,
  onFeatureStub,
  onLoad,
  onLoadStoredProject,
  onSave,
  savedProjects,
  saveStatus,
}: {
  project: ProjectDocument
  onSave: () => void | Promise<void>
  onLoad: (file: File) => void
  onLoadStoredProject: (projectId: string) => void
  onExportCsv: () => void
  onBlueprint: () => void
  onFeatureStub: (label: string) => void
  savedProjects: StoredProjectSummary[]
  saveStatus: string
}) {
  const undo = useBimProjectStore((state) => state.undo)
  const redo = useBimProjectStore((state) => state.redo)
  const past = useBimProjectStore((state) => state.past)
  const future = useBimProjectStore((state) => state.future)
  const workspaceMode = useBimProjectStore((state) => state.workspaceMode)
  const setWorkspaceMode = useBimProjectStore((state) => state.setWorkspaceMode)
  const activeLevelId = useBimProjectStore((state) => state.activeLevelId)
  const setActiveLevel = useBimProjectStore((state) => state.setActiveLevel)
  const snapFeet = useBimProjectStore((state) => state.snapFeet)
  const setSnapFeet = useBimProjectStore((state) => state.setSnapFeet)
  const selectedStore = useBimProjectStore((state) => state.selectedStore)
  const setSelectedStore = useBimProjectStore((state) => state.setSelectedStore)
  const cart = useBimProjectStore((state) => state.cart)
  const removeFromCart = useBimProjectStore((state) => state.removeFromCart)
  const updateCartItem = useBimProjectStore((state) => state.updateCartItem)
  const clearCart = useBimProjectStore((state) => state.clearCart)
  const loadRef = useRef<HTMLInputElement | null>(null)
  const [nearbyStores, setNearbyStores] = useState<{ storeId: string; storeName: string }[]>([])
  const [showCart, setShowCart] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [showProjects, setShowProjects] = useState(false)
  const [lastShareId, setLastShareId] = useState<string | null>(null)
  const cartQty = cart.reduce((sum, item) => sum + item.quantity, 0)

  async function createServerCart() {
    const items = cart.map((item) => ({ sku: item.product.sku, quantity: item.quantity }))
    try {
      const resp = await fetch('/api/store/cart/share', {
        body: JSON.stringify({ items }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      if (!resp.ok) throw new Error('server error')
      const json = await resp.json()
      const shortUrl = json?.shortUrl ?? (json?.id ? `/s/${json.id}` : undefined)
      if (!shortUrl) {
        window.alert('Server returned no share URL')
        return
      }
      const full = shortUrl.startsWith('http') ? shortUrl : `${window.location.origin}${shortUrl}`
      setLastShareId(json?.id ?? null)
      try {
        await navigator.clipboard.writeText(full)
        window.alert('Share link copied to clipboard')
      } catch {
        window.prompt('Copy this share link', full)
      }
      window.open(full, '_blank')
    } catch (error) {
      console.error(error)
      window.alert('Failed to create server cart')
    }
  }

  async function revokeServerCart() {
    if (!lastShareId) {
      window.alert('No share to revoke')
      return
    }
    try {
      const res = await fetch(`/api/store/cart/share/${lastShareId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('revoke failed')
      setLastShareId(null)
      window.alert('Share revoked')
    } catch (error) {
      console.error(error)
      window.alert('Failed to revoke share')
    }
  }

  useEffect(() => {
    let mounted = true
    const zip = project.suppliers?.zipCode ?? '96813'
    fetch(`/api/store/nearby?zipCode=${encodeURIComponent(zip)}`)
      .then((response) => response.json())
      .then((data) => {
        if (!mounted) return
        setNearbyStores((data?.stores ?? []).map((store: { storeId: string; storeName: string }) => ({ storeId: store.storeId, storeName: store.storeName })))
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [project.suppliers?.zipCode])

  return (
    <header className="studio-topbar">
      <div className="studio-brand">
        <span className="studio-logo">CH</span>
        <strong>Contractor Hub</strong>
      </div>

      <button className="project-switcher" title="Open saved projects" onClick={() => setShowProjects((showing) => !showing)}>
        <span>{project.name}</span>
        <Icon name="chevronDown" size={14} />
      </button>

      <span className="save-state"><Icon name="check" size={15} /> {saveStatus}</span>

      <div className="topbar-actions" aria-label="File commands">
        <button onClick={() => void onSave()} title="Save project to storage"><Icon name="save" /> <span>Save</span></button>
        <button onClick={() => loadRef.current?.click()} title="Load project"><Icon name="load" /> <span>Load</span></button>
        <button onClick={() => setShowMore((showing) => !showing)} title="Export and package actions"><Icon name="export" /> <span>Export</span></button>
        <button onClick={undo} disabled={past.length === 0} title="Undo"><Icon name="undo" /> <span>Undo</span></button>
        <button onClick={redo} disabled={future.length === 0} title="Redo"><Icon name="redo" /> <span>Redo</span></button>
      </div>

      <WorkspaceModeSwitch value={workspaceMode} onChange={setWorkspaceMode} />

      <div className="topbar-setup">
        <label className="compact-select">
          <span>Level</span>
          <select value={activeLevelId} onChange={(event) => setActiveLevel(event.target.value)}>
            {project.levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}
          </select>
        </label>
        <label className="compact-select">
          <span>Snap</span>
          <select value={snapFeet} onChange={(event) => setSnapFeet(Number(event.target.value))}>
            <option value={0.25}>1/4 ft</option>
            <option value={0.5}>1/2 ft</option>
            <option value={1}>1 ft</option>
            <option value={2}>2 ft</option>
          </select>
        </label>
      </div>

      <div className="store-cluster" aria-label="Store and cart">
        <label className="store-pill" title={selectedStore?.name ?? 'Choose a store'}>
          <Icon name="store" />
          <select
            value={selectedStore?.id ?? ''}
            onChange={(event) => {
              const found = nearbyStores.find((store) => store.storeId === event.currentTarget.value)
              setSelectedStore(found ? { id: found.storeId, name: found.storeName, zipCode: project.suppliers?.zipCode } : null)
            }}
          >
            <option value="">Store: None</option>
            {nearbyStores.map((store) => <option key={store.storeId} value={store.storeId}>Store: {store.storeName}</option>)}
          </select>
        </label>
        <button className="cart-button" onClick={() => setShowCart((showing) => !showing)} title="Open cart">
          <Icon name="cart" /> <span>Cart {cartQty}</span>
        </button>
      </div>

      <div className="account-cluster">
        <button className="icon-button" onClick={() => onFeatureStub('Help center')} title="Help"><Icon name="help" /></button>
        <button className="icon-button" onClick={() => onFeatureStub('Collaboration')} title="Collaboration"><Icon name="spark" /></button>
        <button className="avatar-button" onClick={() => onFeatureStub('User login')}>JS</button>
      </div>

      <input
        ref={loadRef}
        className="hidden-file-input"
        type="file"
        accept="application/json,.json"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onLoad(file)
          event.currentTarget.value = ''
        }}
      />

      {showMore && (
        <div className="topbar-menu studio-menu">
          <button onClick={() => { onExportCsv(); setShowMore(false) }}><Icon name="download" /> BOM CSV</button>
          <button onClick={() => { onBlueprint(); setShowMore(false) }}><Icon name="copy" /> Blueprint package</button>
          <button onClick={() => onFeatureStub('Cloud publish')}><Icon name="spark" /> Publish set</button>
        </div>
      )}

      {showProjects && (
        <div className="project-menu studio-menu">
          <div className="project-menu-header">
            <strong>Projects</strong>
            <button className="secondary" onClick={() => { void onSave(); setShowProjects(false) }}>
              <Icon name="save" /> Save current
            </button>
          </div>
          <button
            className="project-menu-item active"
            onClick={() => setShowProjects(false)}
            title={project.name}
          >
            <span>{project.name}</span>
            <small>Open now</small>
          </button>
          {savedProjects.filter((saved) => saved.id !== project.id).map((saved) => (
            <button
              key={saved.id}
              className="project-menu-item"
              onClick={() => {
                onLoadStoredProject(saved.id)
                setShowProjects(false)
              }}
              title={saved.name}
            >
              <span>{saved.name}</span>
              <small>{saved.updatedAt ? new Date(saved.updatedAt).toLocaleString() : 'Saved project'}</small>
            </button>
          ))}
          {savedProjects.length <= 1 && <p className="muted">Save more projects to open them as project tabs.</p>}
          <button className="secondary" onClick={() => { loadRef.current?.click(); setShowProjects(false) }}>
            <Icon name="load" /> Import JSON
          </button>
        </div>
      )}

      {showCart && (
        <div className="cart-panel">
          {cart.length === 0 && <p className="muted">Your cart is empty.</p>}
          {Object.entries(
            cart.reduce<Record<string, typeof cart>>((acc, item) => {
              const key = item.product.storeName || item.product.supplier
              acc[key] = acc[key] || []
              acc[key].push(item)
              return acc
            }, {}),
          ).map(([store, items]) => (
            <div className="cart-store" key={store}>
              <strong>{store}</strong>
              <ul>
                {items.map((item) => (
                  <li key={item.product.sku} className="cart-item">
                    <a href={item.product.productUrl} target="_blank" rel="noreferrer">{item.product.title}</a>
                    <div className="cart-qty">
                      <button onClick={() => updateCartItem(item.product.sku, Math.max(0, item.quantity - 1))}>-</button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateCartItem(item.product.sku, item.quantity + 1)}>+</button>
                    </div>
                    <button className="remove" onClick={() => removeFromCart(item.product.sku)}>Remove</button>
                  </li>
                ))}
              </ul>
              <div className="cart-actions">
                <button onClick={() => items.forEach((item) => window.open(item.product.productUrl, '_blank'))}>Open items in store</button>
              </div>
            </div>
          ))}
          {cart.length > 0 && (
            <div className="cart-footer">
              <button onClick={createServerCart}>Create & Copy Link</button>
              {lastShareId && <button onClick={revokeServerCart}>Revoke link</button>}
              <button onClick={() => { clearCart(); setShowCart(false) }}>Clear cart</button>
            </div>
          )}
        </div>
      )}
    </header>
  )
}

function WorkspaceModeSwitch({ value, onChange }: { value: WorkspaceMode; onChange: (mode: WorkspaceMode) => void }) {
  return (
    <div className="workspace-mode-switch" aria-label="Workspace mode">
      {workspaceModes.map((mode) => (
        <button key={mode.id} className={value === mode.id ? 'active' : ''} onClick={() => onChange(mode.id)}>
          <Icon name={mode.icon} />
          <span>{mode.label}</span>
        </button>
      ))}
    </div>
  )
}
