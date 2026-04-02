import { useState, useRef, useCallback, useEffect } from 'react'
import { TopNav } from '../components/TopNav'
import { useTheme } from '../store'

// ─── Types ───────────────────────────────────────────────────────────────────
interface NavNode {
  _id: string
  label: string
  description: string | null
  image_id: number | null
  class_name: string | null
  nav_sequence: number
  link_url: string | null
  link_use_page: boolean
  disclaimer: string | null
  children: NavNode[]
  metadata: Record<string, unknown>
  visible: boolean
  cdn_image_id: number | null
}

let _idCounter = 0
function mkId() { return `n_${Date.now()}_${++_idCounter}` }

function assignIds(nodes: unknown[]): NavNode[] {
  return (nodes as NavNode[]).map(n => ({
    ...n as NavNode,
    _id: mkId(),
    children: (n as NavNode).children ? assignIds((n as NavNode).children) : []
  }))
}

function stripIds(nodes: NavNode[]): unknown[] {
  return nodes.map(({ _id, children, ...rest }) => ({ ...rest, children: stripIds(children) }))
}

function cloneNode(n: NavNode): NavNode {
  return { ...n, _id: mkId(), label: n.label + ' (copy)', children: n.children.map(cloneNode) }
}

// ─── Clipboard (module level) ─────────────────────────────────────────────
let clipboard: NavNode | null = null

// ─── Drag state ───────────────────────────────────────────────────────────
let dragNode: NavNode | null = null
let dragParentId: string | null = null

// ─── Tree traversal helpers ──────────────────────────────────────────────
function flatten(ns: NavNode[]): NavNode[] {
  return ns.flatMap(n => [n, ...flatten(n.children)])
}

function findNode(ns: NavNode[], id: string): NavNode | null {
  for (const n of ns) {
    if (n._id === id) return n
    const found = findNode(n.children, id)
    if (found) return found
  }
  return null
}

function findParentId(ns: NavNode[], id: string, parentId: string | null = null): string | null {
  for (const n of ns) {
    if (n._id === id) return parentId
    const found = findParentId(n.children, id, n._id)
    if (found !== undefined) return found
  }
  return null
}

function updateNode(ns: NavNode[], id: string, patch: Partial<NavNode>): NavNode[] {
  return ns.map(n => n._id === id ? { ...n, ...patch } : { ...n, children: updateNode(n.children, id, patch) })
}

function deleteNode(ns: NavNode[], id: string): NavNode[] {
  return ns.filter(n => n._id !== id).map(n => ({ ...n, children: deleteNode(n.children, id) }))
}

function addChild(ns: NavNode[], parentId: string | null, child: NavNode): NavNode[] {
  if (parentId === null) return [...ns, child]
  return ns.map(n => n._id === parentId
    ? { ...n, children: [...n.children, child] }
    : { ...n, children: addChild(n.children, parentId, child) }
  )
}

function insertAfter(ns: NavNode[], targetId: string, newNode: NavNode): NavNode[] {
  const idx = ns.findIndex(n => n._id === targetId)
  if (idx !== -1) {
    const arr = [...ns]
    arr.splice(idx + 1, 0, newNode)
    return arr
  }
  return ns.map(n => ({ ...n, children: insertAfter(n.children, targetId, newNode) }))
}

function reorderNodes(ns: NavNode[], parentId: string | null, from: number, to: number): NavNode[] {
  if (parentId === null) {
    const arr = [...ns]; const [item] = arr.splice(from, 1); arr.splice(to, 0, item); return arr
  }
  return ns.map(n => {
    if (n._id === parentId) {
      const arr = [...n.children]; const [item] = arr.splice(from, 1); arr.splice(to, 0, item)
      return { ...n, children: arr }
    }
    return { ...n, children: reorderNodes(n.children, parentId, from, to) }
  })
}

// ─── NavRow ───────────────────────────────────────────────────────────────
function NavRow({
  node, depth, parentId, siblings, sibIdx, expandedIds,
  selected, onSelect, onToggleExpand, onUpdate, onReorder,
  onDelete, onAddChild, onDuplicate, onCopy, onPasteAfter
}: {
  node: NavNode; depth: number; parentId: string | null
  siblings: NavNode[]; sibIdx: number
  expandedIds: Set<string>
  selected: string | null
  onSelect: (id: string) => void
  onToggleExpand: (id: string) => void
  onUpdate: (id: string, p: Partial<NavNode>) => void
  onReorder: (parentId: string | null, from: number, to: number) => void
  onDelete: (id: string, parentId: string | null) => void
  onAddChild: (parentId: string | null, afterId?: string) => void
  onDuplicate: (id: string, parentId: string | null) => void
  onCopy: (id: string) => void
  onPasteAfter: (afterId: string) => void
}) {
  const [dragOver, setDragOver] = useState<'before' | 'after' | null>(null)
  const expanded = expandedIds.has(node._id)
  const isSelected = selected === node._id
  const indent = depth * 18

  const metaType = node.metadata && typeof node.metadata.type === 'string' ? node.metadata.type : null

  const TYPE_COLORS: Record<string, string> = {
    cta: 'var(--blue)', button: 'var(--accent)', rtg: 'var(--gold)',
    'rtg-mobile': 'var(--orange)', 'image-card': 'var(--green)', link: 'var(--text-3)'
  }

  return (
    <div>
      {dragOver === 'before' && <div style={{ height: 2, background: 'var(--accent)', margin: '1px 0', borderRadius: 1 }} />}

      <div
        className={`nt-tree-row${isSelected ? ' selected' : ''}`}
        draggable
        onDragStart={() => { dragNode = node; dragParentId = parentId }}
        onDragOver={e => {
          e.preventDefault()
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
          setDragOver(e.clientY < rect.top + rect.height / 2 ? 'before' : 'after')
        }}
        onDragLeave={() => setDragOver(null)}
        onDrop={e => {
          e.preventDefault(); setDragOver(null)
          if (!dragNode || dragNode._id === node._id || dragParentId !== parentId) return
          const fromIdx = siblings.findIndex(s => s._id === dragNode!._id)
          let toIdx = dragOver === 'before' ? sibIdx : sibIdx + 1
          if (fromIdx < toIdx) toIdx--
          if (fromIdx !== toIdx) onReorder(parentId, fromIdx, toIdx)
        }}
        onDragEnd={() => { dragNode = null; dragParentId = null; setDragOver(null) }}
        onClick={() => onSelect(node._id)}
        style={{ paddingLeft: indent + 8, paddingRight: 6, paddingTop: 5, paddingBottom: 5, gap: 5 }}
      >
        {/* Expand toggle */}
        <button onClick={e => { e.stopPropagation(); onToggleExpand(node._id) }}
          style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', width: 16, height: 16, padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {node.children.length > 0
            ? <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                {expanded ? <path d="m18 15-6-6-6 6" /> : <path d="m6 9 6 6 6-6" />}
              </svg>
            : <span style={{ width: 9 }} />}
        </button>

        {/* Drag handle */}
        <span style={{ color: 'var(--text-3)', cursor: 'grab', fontSize: 11, flexShrink: 0, lineHeight: 1, opacity: .5 }}>⠿</span>

        {/* Visible dot */}
        <span title={node.visible ? 'Visible' : 'Hidden'}
          style={{ width: 6, height: 6, borderRadius: '50%', background: node.visible ? 'var(--green)' : 'var(--red)', flexShrink: 0, cursor: 'pointer' }}
          onClick={e => { e.stopPropagation(); onUpdate(node._id, { visible: !node.visible }) }} />

        {/* Label */}
        <span style={{ flex: 1, fontSize: depth === 0 ? '0.88rem' : depth === 1 ? '0.82rem' : '0.76rem', fontWeight: depth === 0 ? 700 : depth === 1 ? 600 : 500, color: depth === 0 ? 'var(--text)' : 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.label || <em style={{ color: 'var(--text-3)', fontWeight: 400 }}>Untitled</em>}
        </span>

        {/* Tags */}
        {node.children.length > 0 && (
          <span style={{ fontSize: '0.52rem', color: 'var(--text-3)', background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '1px 5px', borderRadius: 10, flexShrink: 0 }}>
            {node.children.length}
          </span>
        )}
        {metaType && (
          <span style={{ fontSize: '0.5rem', color: TYPE_COLORS[metaType] || 'var(--text-3)', background: 'rgba(255,255,255,.04)', border: `1px solid ${TYPE_COLORS[metaType] || 'var(--border)'}44`, padding: '1px 5px', borderRadius: 4, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            {metaType}
          </span>
        )}

        {/* Action buttons — shown on hover via CSS would be ideal, but we keep them compact */}
        <div style={{ display: 'flex', gap: 2, flexShrink: 0, opacity: isSelected ? 1 : 0.35 }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
          onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.opacity = '0.35' }}>

          <button className="nt-action-btn accent" title="Add child" onClick={e => { e.stopPropagation(); onAddChild(node._id) }}>+</button>
          <button className="nt-action-btn" title="Duplicate" onClick={e => { e.stopPropagation(); onDuplicate(node._id, parentId) }}>⧉</button>
          <button className="nt-action-btn" title="Copy" onClick={e => { e.stopPropagation(); onCopy(node._id) }}>📋</button>
          {clipboard && <button className="nt-action-btn" title="Paste after" onClick={e => { e.stopPropagation(); onPasteAfter(node._id) }}>📌</button>}
          <button className="nt-action-btn danger" title="Delete" onClick={e => { e.stopPropagation(); if (confirm(`Delete "${node.label}"?`)) onDelete(node._id, parentId) }}>×</button>
        </div>
      </div>

      {dragOver === 'after' && <div style={{ height: 2, background: 'var(--accent)', margin: '1px 0', borderRadius: 1 }} />}

      {expanded && node.children.map((child, i) => (
        <NavRow key={child._id} node={child} depth={depth + 1} parentId={node._id}
          siblings={node.children} sibIdx={i} expandedIds={expandedIds}
          selected={selected} onSelect={onSelect} onToggleExpand={onToggleExpand}
          onUpdate={onUpdate} onReorder={onReorder} onDelete={onDelete}
          onAddChild={onAddChild} onDuplicate={onDuplicate} onCopy={onCopy} onPasteAfter={onPasteAfter} />
      ))}
    </div>
  )
}

// ─── Edit Panel ────────────────────────────────────────────────────────────
function EditPanel({ node, onUpdate }: { node: NavNode | null; onUpdate: (id: string, p: Partial<NavNode>) => void }) {
  if (!node) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, color: 'var(--text-3)', fontSize: '0.78rem' }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
      Select a node to edit
    </div>
  )

  const inp = (label: string, key: keyof NavNode, type: 'text' | 'check' | 'textarea' | 'number' = 'text') => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: '0.52rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 3 }}>{label}</div>
      {type === 'check'
        ? <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: '0.7rem', color: 'var(--text-2)' }}>
            <input type="checkbox" checked={Boolean(node[key])} onChange={e => onUpdate(node._id, { [key]: e.target.checked } as Partial<NavNode>)} style={{ accentColor: 'var(--accent)', width: 14, height: 14 }} />
            {Boolean(node[key]) ? 'Yes' : 'No'}
          </label>
        : type === 'textarea'
          ? <textarea value={String(node[key] || '')} onChange={e => onUpdate(node._id, { [key]: e.target.value } as Partial<NavNode>)}
              style={{ width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', fontFamily: 'inherit', fontSize: '0.68rem', padding: '6px 8px', outline: 'none', resize: 'vertical', minHeight: 58 }} />
          : <input type={type} value={String(node[key] ?? '')} onChange={e => onUpdate(node._id, { [key]: type === 'number' ? Number(e.target.value) : e.target.value } as Partial<NavNode>)}
              style={{ width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', fontFamily: 'inherit', fontSize: '0.7rem', padding: '6px 8px', outline: 'none' }} />
      }
    </div>
  )

  return (
    <div style={{ padding: '12px 14px', overflowY: 'auto', height: '100%' }}>
      <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: node.visible ? 'var(--green)' : 'var(--red)', flexShrink: 0 }} />
        {node.label || 'Untitled'}
        <button onClick={() => onUpdate(node._id, { visible: !node.visible })}
          style={{ marginLeft: 'auto', fontSize: '0.56rem', background: node.visible ? 'var(--green-dim)' : 'var(--red-dim)', border: `1px solid ${node.visible ? 'rgba(34,197,94,.3)' : 'rgba(232,66,74,.3)'}`, borderRadius: 4, color: node.visible ? 'var(--green)' : 'var(--red)', padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>
          {node.visible ? 'Visible' : 'Hidden'}
        </button>
      </div>
      {inp('Label', 'label')}
      {inp('Description', 'description', 'textarea')}
      {inp('Link URL', 'link_url')}
      {inp('Use Page Link', 'link_use_page', 'check')}
      {inp('Class Name', 'class_name')}
      {inp('CDN Image ID', 'cdn_image_id', 'number')}
      {inp('Nav Sequence', 'nav_sequence', 'number')}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: '0.52rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 3 }}>Disclaimer (HTML)</div>
        <textarea value={String(node.disclaimer || '')} onChange={e => onUpdate(node._id, { disclaimer: e.target.value })}
          style={{ width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', fontFamily: 'monospace', fontSize: '0.62rem', padding: '6px 8px', outline: 'none', resize: 'vertical', minHeight: 58 }} />
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: '0.52rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 3 }}>Metadata (JSON)</div>
        <textarea key={node._id} defaultValue={JSON.stringify(node.metadata || {}, null, 2)} onBlur={e => {
          try { onUpdate(node._id, { metadata: JSON.parse(e.target.value) }) } catch { alert('Invalid JSON') }
        }} style={{ width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', fontFamily: 'monospace', fontSize: '0.62rem', padding: '6px 8px', outline: 'none', resize: 'vertical', minHeight: 70 }} />
      </div>
    </div>
  )
}

// ─── Navigation Editor ────────────────────────────────────────────────────
function NavigationEditor() {
  const [nodes, setNodes] = useState<NavNode[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [msg, setMsg] = useState('')
  const [clipMsg, setClipMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const flash = (m: string, ms = 2800) => { setMsg(m); setTimeout(() => setMsg(''), ms) }

  const getAllIds = useCallback((ns: NavNode[]): string[] => ns.flatMap(n => [n._id, ...getAllIds(n.children)]), [])

  const loadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const r = new FileReader()
    r.onload = ev => {
      try {
        const json = JSON.parse(ev.target!.result as string)
        const data = json.data || json
        const arr = Array.isArray(data) ? data : [data]
        const parsed = assignIds(arr)
        setNodes(parsed)
        setExpandedIds(new Set(getAllIds(parsed).slice(0, 60)))
        setSelected(null)
        flash(`✓ Loaded ${arr.length} root items`)
      } catch { flash('✗ Invalid JSON') }
    }
    r.readAsText(f); e.target.value = ''
  }

  const exportJSON = () => {
    const out = JSON.stringify({ data: stripIds(nodes) }, null, 2)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([out], { type: 'application/json' }))
    a.download = `navigation_export_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`
    a.click(); flash('✓ Exported!')
  }

  const setNodes_ = (fn: (prev: NavNode[]) => NavNode[]) => setNodes(fn)

  const onUpdate = (id: string, patch: Partial<NavNode>) => setNodes_(p => updateNode(p, id, patch))
  const onDelete = (id: string, parentId: string | null) => {
    setNodes_(p => deleteNode(p, id))
    if (selected === id) setSelected(null)
  }
  const onAddChild = (parentId: string | null, _afterId?: string) => {
    const newNode: NavNode = { _id: mkId(), label: 'NEW ITEM', description: null, image_id: null, class_name: null, nav_sequence: 0, link_url: null, link_use_page: false, disclaimer: null, children: [], metadata: { type: 'cta' }, visible: true, cdn_image_id: null }
    setNodes_(p => addChild(p, parentId, newNode))
    if (parentId) setExpandedIds(s => new Set([...s, parentId]))
    setSelected(newNode._id)
  }
  const onDuplicate = (id: string, parentId: string | null) => {
    const node = findNode(nodes, id); if (!node) return
    const clone = cloneNode(node)
    setNodes_(p => insertAfter(p, id, clone))
    setSelected(clone._id)
    flash('✓ Duplicated')
  }
  const onCopy = (id: string) => {
    const node = findNode(nodes, id); if (!node) return
    clipboard = cloneNode(node)
    setClipMsg(`📋 "${node.label}" copied`)
    setTimeout(() => setClipMsg(''), 3000)
  }
  const onPasteAfter = (afterId: string) => {
    if (!clipboard) return
    const newNode = cloneNode(clipboard)
    setNodes_(p => insertAfter(p, afterId, newNode))
    setSelected(newNode._id)
    flash('✓ Pasted')
  }
  const onToggleExpand = (id: string) => setExpandedIds(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n
  })
  const expandAll = () => setExpandedIds(new Set(getAllIds(nodes)))
  const collapseAll = () => setExpandedIds(new Set())
  const onReorder = (parentId: string | null, from: number, to: number) => setNodes_(p => reorderNodes(p, parentId, from, to))

  // Keyboard shortcuts: Ctrl+C = copy selected, Ctrl+V = paste after selected
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Don't hijack when typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selected) {
        onCopy(selected); e.preventDefault()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (selected) onPasteAfter(selected)
        else if (clipboard) { setNodes_(p => [...p, cloneNode(clipboard!)]); flash('✓ Pasted at root') }
        e.preventDefault()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selected) {
        const found = selected; const node = findNode(nodes, found)
        if (node) { const parentId = findParentId(nodes, found); onDuplicate(found, parentId) }
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selected, nodes])

  const all = flatten(nodes)
  const selectedNode = selected ? all.find(n => n._id === selected) || null : null
  const searchResults = search ? all.filter(n => n.label.toLowerCase().includes(search.toLowerCase())) : []

  const Btn = ({ children, onClick, disabled, title, variant = 'ghost' }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; title?: string; variant?: 'ghost' | 'primary' | 'accent' }) => (
    <button onClick={onClick} disabled={disabled} title={title}
      className={variant === 'primary' ? 'btn-primary' : 'btn-ghost'}
      style={variant === 'accent' ? { background: 'var(--accent-dim)', border: '1px solid var(--accent-brd)', color: 'var(--accent)', borderRadius: 5, padding: '4px 10px', fontSize: '0.66rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 } : undefined}>
      {children}
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, flexWrap: 'wrap', background: 'var(--surface)' }}>
        <input type="file" ref={fileRef} accept=".json" onChange={loadFile} style={{ display: 'none' }} />
        <Btn variant="primary" onClick={() => fileRef.current?.click()}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
          Import JSON
        </Btn>
        <Btn onClick={exportJSON} disabled={!nodes.length}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          Export JSON
        </Btn>
        <div style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />
        <Btn onClick={() => onAddChild(null)} title="Add a new top-level root item to the tree">+ Root</Btn>
        <Btn onClick={expandAll} disabled={!nodes.length}>Expand All</Btn>
        <Btn onClick={collapseAll} disabled={!nodes.length}>Collapse All</Btn>
        {clipboard && (
          <Btn variant="accent" onClick={() => { if (selected) onPasteAfter(selected); else { setNodes_(p => [...p, cloneNode(clipboard!)]); flash('✓ Pasted at root') } }}>
            📌 Paste {clipboard.label.slice(0, 20)}{clipboard.label.length > 20 ? '…' : ''}
          </Btn>
        )}
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            style={{ paddingLeft: 24, paddingRight: 8, paddingTop: 5, paddingBottom: 5, background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', fontSize: '0.68rem', outline: 'none', width: 150, fontFamily: 'inherit' }} />
        </div>
        <span style={{ fontSize: '0.62rem', color: 'var(--text-3)' }}>{nodes.length} root</span>
        <span style={{ fontSize: '0.55rem', color: 'var(--text-3)', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', letterSpacing: '.04em' }}>Ctrl+C copy · Ctrl+V paste · Ctrl+D duplicate</span>
        {msg && <span style={{ fontSize: '0.65rem', color: msg.startsWith('✓') ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{msg}</span>}
        {clipMsg && <span style={{ fontSize: '0.62rem', color: 'var(--accent)' }}>{clipMsg}</span>}
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Tree */}
        <div style={{ flex: '0 0 60%', borderRight: '1px solid var(--border)', overflowY: 'auto' }}>
          {nodes.length === 0
            ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 250, gap: 12, color: 'var(--text-3)', fontSize: '0.78rem' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                Import a navigation JSON to begin
              </div>
            : search
              ? <div>
                  <div style={{ padding: '6px 12px', fontSize: '0.6rem', color: 'var(--text-3)', borderBottom: '1px solid var(--border)' }}>{searchResults.length} results for "{search}"</div>
                  {searchResults.map(n => (
                    <div key={n._id} onClick={() => setSelected(n._id)}
                      style={{ padding: '7px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', background: n._id === selected ? 'var(--accent-dim)' : 'transparent', fontSize: '0.72rem', color: 'var(--text-2)', transition: 'background .1s' }}>
                      {n.label}
                    </div>
                  ))}
                </div>
              : nodes.map((n, i) => (
                  <NavRow key={n._id} node={n} depth={0} parentId={null} siblings={nodes} sibIdx={i}
                    expandedIds={expandedIds} selected={selected} onSelect={setSelected}
                    onToggleExpand={onToggleExpand} onUpdate={onUpdate} onReorder={onReorder}
                    onDelete={onDelete} onAddChild={onAddChild} onDuplicate={onDuplicate}
                    onCopy={onCopy} onPasteAfter={onPasteAfter} />
                ))
          }
        </div>

        {/* Edit panel */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', background: 'var(--surface)' }}>
          <EditPanel node={selectedNode} onUpdate={onUpdate} />
        </div>
      </div>
    </div>
  )
}

// ─── Footer Visual Editor ─────────────────────────────────────────────────

interface FItem {
  _id: string
  label: string
  url?: string
  target?: string
  type?: string
  class?: string | null
  id?: string | null
  icon?: string
  rel?: string
  aria?: { label: string }
  dc_strategy?: unknown
  [key: string]: unknown
}
interface FRow { _id: string; heading: string; items: FItem[] }
interface FCol { _id: string; rows: FRow[]; type?: string }
interface FooterData { columns: FCol[] }

function fid() { return `f_${Date.now()}_${Math.random().toString(36).slice(2,6)}` }

function parseFooterJson(raw: string): FooterData | null {
  try {
    const j = JSON.parse(raw)
    const cols: FCol[] = (j.columns || j.data || (Array.isArray(j) ? j : [j])).map((col: unknown) => {
      const c = col as Record<string, unknown>
      return {
        _id: fid(),
        type: c.type as string | undefined,
        rows: ((c.rows || []) as unknown[]).map((row: unknown) => {
          const r = row as Record<string, unknown>
          return {
            _id: fid(),
            heading: (r.heading as string) || '',
            items: ((r.items || []) as unknown[]).map((it: unknown) => ({ ...(it as object), _id: fid() }))
          }
        })
      }
    })
    return { columns: cols }
  } catch { return null }
}

function footerToJson(data: FooterData): string {
  const cols = data.columns.map(col => ({
    ...(col.type ? { type: col.type } : {}),
    rows: col.rows.map(row => ({
      heading: row.heading,
      items: row.items.map(({ _id, ...rest }) => rest)
    }))
  }))
  return JSON.stringify({ columns: cols }, null, 2)
}

const SOCIAL_ICONS: Record<string, string> = {
  instagram: `<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" fill="none" stroke="white" strokeWidth="1.5"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" stroke="white" strokeWidth="2"/></svg>`,
  youtube: `<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="rgba(255,0,0,1)" style="fill:#ff0000"/></svg>`,
  facebook: `<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>`,
  twitter: `<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M4 4l16 16M4 20L20 4" stroke="white" strokeWidth="2.5"/></svg>`,
}
const SOCIAL_BG: Record<string, string> = {
  instagram: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)',
  youtube: '#ff0000',
  facebook: '#1877f2',
  twitter: '#000',
}

// Module-level drag state for footer items
let fDragSrc: {ci:number;ri:number;ii:number} | null = null

function FooterEditor() {
  const [data, setData] = useState<FooterData | null>(null)
  const [rawJson, setRawJson] = useState('')
  const [view, setView] = useState<'paste'|'visual'|'json'>('paste')
  const [selected, setSelected] = useState<{col:number,row:number,item:number}|null>(null)
  const [msg, setMsg] = useState('')
  const [dragOverTarget, setDragOverTarget] = useState<string|null>(null)
  const originalDataRef = useRef<FooterData | null>(null)

  const flash = (m: string) => { setMsg(m); setTimeout(()=>setMsg(''), 2500) }

  function load() {
    const parsed = parseFooterJson(rawJson)
    if (!parsed) { flash('✗ Invalid JSON'); return }
    originalDataRef.current = JSON.parse(JSON.stringify(parsed)) // deep clone for reset
    setData(parsed)
    setView('visual')
    flash(`✓ Loaded ${parsed.columns.length} columns`)
  }

  function resetToOriginal() {
    if (!originalDataRef.current) return
    setData(JSON.parse(JSON.stringify(originalDataRef.current)))
    setSelected(null)
    flash('✓ Reset to original state')
  }

  function exportJson() {
    if (!data) return
    const out = footerToJson(data)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([out],{type:'application/json'}))
    a.download = `footer_export_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.json`
    a.click(); flash('✓ Exported!')
  }

  function updateItem(ci: number, ri: number, ii: number, patch: Partial<FItem>) {
    setData(d => {
      if (!d) return d
      const cols = d.columns.map((col,cii) => cii!==ci ? col : {
        ...col, rows: col.rows.map((row,rii) => rii!==ri ? row : {
          ...row, items: row.items.map((it,iii) => iii!==ii ? it : {...it,...patch})
        })
      })
      return {...d, columns: cols}
    })
  }

  function updateRowHeading(ci: number, ri: number, heading: string) {
    setData(d => {
      if (!d) return d
      return { ...d, columns: d.columns.map((col,cii) => cii!==ci ? col : {
        ...col, rows: col.rows.map((row,rii) => rii!==ri ? row : {...row, heading})
      })}
    })
  }

  function addItem(ci: number, ri: number) {
    const newItem: FItem = { _id: fid(), label: 'NEW ITEM', url: '/en/', target: '_self', type: 'link' }
    setData(d => {
      if (!d) return d
      return { ...d, columns: d.columns.map((col,cii) => cii!==ci ? col : {
        ...col, rows: col.rows.map((row,rii) => rii!==ri ? row : { ...row, items: [...row.items, newItem] })
      })}
    })
    setSelected({col:ci, row:ri, item: (data?.columns[ci]?.rows[ri]?.items.length || 0)})
  }

  function removeItem(ci: number, ri: number, ii: number) {
    setData(d => {
      if (!d) return d
      return { ...d, columns: d.columns.map((col,cii) => cii!==ci ? col : {
        ...col, rows: col.rows.map((row,rii) => rii!==ri ? row : {
          ...row, items: row.items.filter((_,iii) => iii!==ii)
        })
      })}
    })
    if (selected?.col===ci && selected.row===ri && selected.item===ii) setSelected(null)
  }

  function duplicateItem(ci: number, ri: number, ii: number) {
    setData(d => {
      if (!d) return d
      return { ...d, columns: d.columns.map((col,cii) => cii!==ci ? col : {
        ...col, rows: col.rows.map((row,rii) => rii!==ri ? row : {
          ...row, items: [
            ...row.items.slice(0, ii+1),
            {...row.items[ii], _id: fid()},
            ...row.items.slice(ii+1)
          ]
        })
      })}
    })
    setSelected({col:ci, row:ri, item: ii+1})
    flash('✓ Item duplicated')
  }

  function moveItem(ci: number, ri: number, fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return
    setData(d => {
      if (!d) return d
      return { ...d, columns: d.columns.map((col,cii) => cii!==ci ? col : {
        ...col, rows: col.rows.map((row,rii) => rii!==ri ? row : {
          ...row, items: (() => {
            const items = [...row.items]
            const [moved] = items.splice(fromIdx, 1)
            items.splice(toIdx > fromIdx ? toIdx - 1 : toIdx, 0, moved)
            return items
          })()
        })
      })}
    })
  }

  const selItem = selected && data ? data.columns[selected.col]?.rows[selected.row]?.items[selected.item] : null

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Toolbar */}
      <div style={{ padding:'8px 12px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:6, flexShrink:0, background:'var(--surface)', flexWrap:'wrap' }}>
        {(['paste','visual','json'] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            style={{ padding:'4px 13px', borderRadius:5, border:'1px solid', cursor:'pointer', fontFamily:'inherit', fontSize:'0.67rem', fontWeight:600, transition:'all .15s',
              background: view===v ? 'var(--accent-dim)' : 'none',
              borderColor: view===v ? 'var(--accent-brd)' : 'var(--border)',
              color: view===v ? 'var(--accent)' : 'var(--text-2)' }}>
            {v==='paste'?'📝 Paste JSON':v==='visual'?'🖼 Visual Editor':'{ } Raw JSON'}
          </button>
        ))}
        {data && <button onClick={exportJson} className="btn-ghost">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export JSON
        </button>}
        {data && originalDataRef.current && (
          <button onClick={resetToOriginal} className="btn-ghost" style={{ color:'var(--orange)', borderColor:'rgba(232,151,58,.3)' }}>
            ↺ Reset Original
          </button>
        )}
        <div style={{ flex:1 }}/>
        {msg && <span style={{ fontSize:'0.65rem', color:msg.startsWith('✓')?'var(--green)':'var(--red)', fontWeight:600 }}>{msg}</span>}
      </div>

      {/* Paste mode */}
      {view==='paste' && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', padding:14, gap:10 }}>
          <div style={{ fontSize:'0.7rem', color:'var(--text-2)', fontWeight:500 }}>
            Paste the footer JSON (the <code style={{ fontFamily:'monospace', color:'var(--accent)', fontSize:'0.68rem' }}>{"{ columns: [...] }"}</code> structure from the CMS)
          </div>
          <textarea value={rawJson} onChange={e=>setRawJson(e.target.value)}
            placeholder={'{\n  "columns": [\n    {\n      "rows": [\n        {\n          "heading": "OUR VEHICLES",\n          "items": [...]\n        }\n      ]\n    }\n  ]\n}'}
            style={{ flex:1, background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text)', fontFamily:'monospace', fontSize:'0.72rem', padding:12, outline:'none', resize:'none' }} />
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button onClick={load} className="btn-primary">Load & Edit →</button>
            <span style={{ fontSize:'0.62rem', color:'var(--text-3)' }}>Parses JSON and switches to Visual Editor</span>
          </div>
        </div>
      )}

      {/* Raw JSON edit mode */}
      {view==='json' && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', padding:14, gap:10 }}>
          <textarea value={data ? footerToJson(data) : rawJson} onChange={e => {
            setRawJson(e.target.value)
            const parsed = parseFooterJson(e.target.value)
            if (parsed) setData(parsed)
          }}
            style={{ flex:1, background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text)', fontFamily:'monospace', fontSize:'0.7rem', padding:12, outline:'none', resize:'none' }} />
        </div>
      )}

      {/* Visual editor */}
      {view==='visual' && data && (
        <div style={{ display:'flex', flex:1, minHeight:0 }}>
          {/* Footer visual preview — left/main area */}
          <div style={{ flex:1, overflowY:'auto', overflowX:'auto', padding:'20px 16px', background:'var(--bg)' }}>
            {/* Footer layout */}
            <div style={{ display:'flex', gap:32, minWidth:900, alignItems:'flex-start' }}>
              {data.columns.map((col, ci) => (
                <div key={col._id} style={{ flex: col.type==='social' ? '0 0 140px' : 1, minWidth: col.type==='social' ? 130 : 120 }}>
                  {col.rows.map((row, ri) => (
                    <div key={row._id} style={{ marginBottom:24 }}>
                      {/* Heading */}
                      {row.heading && (
                        <div style={{ marginBottom:10 }}>
                          <input
                            value={row.heading}
                            onChange={e => updateRowHeading(ci, ri, e.target.value)}
                            style={{ background:'none', border:'none', outline:'none', cursor:'text', fontFamily:'inherit', fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text)', width:'100%', padding:0 }}
                            onFocus={e => { (e.target as HTMLInputElement).style.background='var(--surface-2)'; (e.target as HTMLInputElement).style.border='1px solid var(--accent-brd)'; (e.target as HTMLInputElement).style.borderRadius='3px'; (e.target as HTMLInputElement).style.padding='2px 4px' }}
                            onBlur={e => { (e.target as HTMLInputElement).style.background='none'; (e.target as HTMLInputElement).style.border='none'; (e.target as HTMLInputElement).style.padding='0' }}
                          />
                        </div>
                      )}
                      {/* Items */}
                      <div style={{ display:'flex', flexDirection: col.type==='social' ? 'column' : 'column', gap: col.type==='social' ? 8 : 2 }}>
                        {row.items.map((item, ii) => {
                          const isSel = selected?.col===ci && selected?.row===ri && selected?.item===ii
                          const isSocial = item.type==='social'
                          const dragKey = `${ci}-${ri}-${ii}`
                          const isDragOver = dragOverTarget === dragKey
                          return (
                            <div key={item._id}
                              draggable
                              onDragStart={() => { fDragSrc = {ci,ri,ii} }}
                              onDragOver={e => { e.preventDefault(); setDragOverTarget(dragKey) }}
                              onDragLeave={() => setDragOverTarget(null)}
                              onDrop={e => {
                                e.preventDefault()
                                setDragOverTarget(null)
                                if (!fDragSrc || fDragSrc.ci!==ci || fDragSrc.ri!==ri) return
                                moveItem(ci, ri, fDragSrc.ii, ii)
                                fDragSrc = null
                              }}
                              onDragEnd={() => { fDragSrc = null; setDragOverTarget(null) }}
                              onClick={() => setSelected({col:ci,row:ri,item:ii})}
                              style={{ cursor:'grab', borderRadius:4, padding: isSocial ? '2px 2px' : '2px 4px',
                                background: isSel ? 'var(--accent-dim)' : 'transparent',
                                border: isDragOver ? '1px dashed var(--accent)' : isSel ? '1px solid var(--accent-brd)' : '1px solid transparent',
                                transition:'all .1s', position:'relative',
                                boxShadow: isDragOver ? 'inset 0 0 0 2px rgba(233,30,140,.2)' : 'none' }}
                              onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,.04)' }}
                              onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background='transparent' }}>
                              {/* Drag handle */}
                              <span style={{ position:'absolute', left:2, top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,.15)', fontSize:9, cursor:'grab', userSelect:'none', lineHeight:1 }}>⠿</span>
                              <div style={{ paddingLeft: 10 }}>
                                {isSocial ? (
                                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                    <div style={{ width:34, height:34, borderRadius:4, background: SOCIAL_BG[item.icon||''] || '#333', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border: isSel?'2px solid var(--accent)':'2px solid transparent' }}
                                      dangerouslySetInnerHTML={{ __html: SOCIAL_ICONS[item.icon||''] || '' }} />
                                    <span style={{ fontSize:'0.66rem', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-2)' }}>{item.label}</span>
                                  </div>
                                ) : (
                                  <span style={{ fontSize:'0.68rem', fontWeight:500, letterSpacing:'0.05em', textTransform:'uppercase', color: isSel ? 'var(--accent)' : 'var(--text-2)', lineHeight:1.5 }}>
                                    {item.label || '—'}
                                  </span>
                                )}
                              </div>
                              {/* Action buttons (visible on hover/select) */}
                              <div style={{ position:'absolute', top:2, right:2, display:'flex', gap:2, opacity: isSel ? 1 : 0, transition:'opacity .1s' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity='1' }}>
                                <button onClick={e => { e.stopPropagation(); duplicateItem(ci,ri,ii) }}
                                  title="Duplicate"
                                  style={{ background:'var(--surface-2)', border:'1px solid var(--border)', color:'var(--text-2)', cursor:'pointer', fontSize:10, lineHeight:1, padding:'2px 5px', borderRadius:3 }}>⧉</button>
                                <button onClick={e => { e.stopPropagation(); removeItem(ci,ri,ii) }}
                                  title="Remove"
                                  style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)', color:'#ef4444', cursor:'pointer', fontSize:10, lineHeight:1, padding:'2px 5px', borderRadius:3 }}>✕</button>
                              </div>
                            </div>
                          )
                        })}
                        <button onClick={() => addItem(ci,ri)}
                          style={{ marginTop:4, background:'none', border:'1px dashed var(--border)', borderRadius:4, color:'var(--text-3)', fontSize:'0.6rem', padding:'3px 8px', cursor:'pointer', textAlign:'left', fontFamily:'inherit', letterSpacing:'0.05em' }}>
                          + Add item
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Right edit panel */}
          <div style={{ flex:'0 0 280px', borderLeft:'1px solid var(--border)', overflowY:'auto', background:'var(--surface)', padding:14 }}>
            {selItem ? (
              <div>
                <div style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:'var(--text-2)', marginBottom:12, paddingBottom:8, borderBottom:'1px solid var(--border)' }}>
                  Edit Item
                </div>
                {([
                  {k:'label',l:'Label'},
                  {k:'url',l:'URL'},
                  {k:'target',l:'Target (_self / _blank)'},
                  {k:'type',l:'Type (link / social)'},
                  {k:'icon',l:'Icon (social only)'},
                  {k:'class',l:'Class'},
                  {k:'rel',l:'Rel'},
                ] as {k:keyof FItem,l:string}[]).map(({k,l}) => (
                  <div key={k} style={{ marginBottom:9 }}>
                    <div style={{ fontSize:'0.5rem', fontWeight:700, letterSpacing:'.14em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:3 }}>{l}</div>
                    <input type="text" value={String(selItem[k]??'')} onChange={e => updateItem(selected!.col, selected!.row, selected!.item, {[k]:e.target.value})}
                      style={{ width:'100%', background:'var(--surface-3)', border:'1px solid var(--border)', borderRadius:5, color:'var(--text)', fontFamily:'inherit', fontSize:'0.7rem', padding:'5px 7px', outline:'none' }} />
                  </div>
                ))}
                <div style={{ marginBottom:9 }}>
                  <div style={{ fontSize:'0.5rem', fontWeight:700, letterSpacing:'.14em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:3 }}>dc_strategy (JSON)</div>
                  <textarea key={selItem._id+'dc'} defaultValue={JSON.stringify(selItem.dc_strategy||null,null,2)}
                    onBlur={e => { try { updateItem(selected!.col, selected!.row, selected!.item, {dc_strategy: JSON.parse(e.target.value)}) } catch {} }}
                    style={{ width:'100%', background:'var(--surface-3)', border:'1px solid var(--border)', borderRadius:5, color:'var(--text)', fontFamily:'monospace', fontSize:'0.62rem', padding:'5px 7px', outline:'none', resize:'vertical', minHeight:60 }} />
                </div>
                <div style={{ display:'flex', gap:6, marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)' }}>
                  <button onClick={() => { duplicateItem(selected!.col, selected!.row, selected!.item) }}
                    className="btn-ghost" style={{ fontSize:'0.65rem' }}>⧉ Duplicate</button>
                  <button onClick={() => removeItem(selected!.col, selected!.row, selected!.item)}
                    className="btn-danger">✕ Remove</button>
                </div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:200, gap:8, color:'var(--text-3)', fontSize:'0.75rem', textAlign:'center' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Click any item to edit it
              </div>
            )}
          </div>
        </div>
      )}

      {view==='visual' && !data && (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-3)', fontSize:'0.78rem', flexDirection:'column', gap:10 }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
          Switch to Paste JSON tab to load footer data
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────
export function NavToolsPage() {
  const [tab, setTab] = useState<'nav' | 'footer'>('nav')
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const TOP = 60 + 44 // nav + tab bar

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>
      <TopNav currentPage="nav-tools" />
      <div className="rf-brand-bar" style={{ position: 'fixed', top: 60, left: 0, right: 0, zIndex: 89 }} />

      {/* Tab bar */}
      <div style={{ position: 'fixed', top: 63, left: 0, right: 0, height: 41, background: isDark ? 'rgba(10,11,13,.97)' : 'rgba(255,255,255,.97)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 6, zIndex: 88, backdropFilter: 'blur(12px)' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '.08em', color: 'var(--text)', marginRight: 8 }}>Navigation Tools</span>
        {(['nav', 'footer'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '4px 14px', borderRadius: 5, border: '1px solid', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.68rem', fontWeight: 600, transition: 'all .15s', background: tab === t ? 'var(--accent-dim)' : 'none', borderColor: tab === t ? 'var(--accent-brd)' : 'var(--border)', color: tab === t ? 'var(--accent)' : 'var(--text-2)' }}>
            {t === 'nav' ? '🌐 Navigation Editor' : '📋 Footer Editor'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ marginTop: TOP, height: `calc(100vh - ${TOP}px)`, overflow: 'hidden' }}>
        {tab === 'nav' && <NavigationEditor />}
        {tab === 'footer' && <FooterEditor />}
      </div>
    </div>
  )
}
