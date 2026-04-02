import { useState, useRef, useCallback } from 'react'
import { TopNav } from '../components/TopNav'
import { Footer } from '../components/Footer'

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
  metadata: Record<string, string | number | boolean | null | undefined | Record<string, unknown>>
  visible: boolean
  cdn_image_id: number | null
}

let _idCounter = 0
function mkId() { return `n_${Date.now()}_${++_idCounter}` }

function assignIds(nodes: unknown[]): NavNode[] {
  return (nodes as NavNode[]).map(n => ({
    ...n,
    _id: mkId(),
    children: n.children ? assignIds(n.children) : []
  }))
}

function stripIds(nodes: NavNode[]): unknown[] {
  return nodes.map(({ _id, children, ...rest }) => ({
    ...rest,
    children: stripIds(children)
  }))
}

// ─── Drag state (module level for simplicity) ──────────────────────────────
let dragNode: NavNode | null = null
let dragParentId: string | null = null

// ─── NavNodeRow ───────────────────────────────────────────────────────────
function NavNodeRow({
  node, depth, parentId, siblings, sibIdx,
  selected, onSelect, onUpdate, onReorder, onDelete, onAdd
}: {
  node: NavNode; depth: number; parentId: string | null; siblings: NavNode[]; sibIdx: number
  selected: string | null; onSelect: (id: string) => void
  onUpdate: (id: string, patch: Partial<NavNode>) => void
  onReorder: (parentId: string | null, from: number, to: number) => void
  onDelete: (id: string, parentId: string | null) => void
  onAdd: (parentId: string | null) => void
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const [dragOver, setDragOver] = useState<'before'|'after'|null>(null)
  const isSelected = selected === node._id

  const indent = depth * 16

  return (
    <div>
      {/* Drop zone before */}
      {dragOver === 'before' && (
        <div style={{ height:2, background:'var(--accent)', margin:'1px 0', borderRadius:1 }} />
      )}

      <div
        draggable
        onDragStart={() => { dragNode = node; dragParentId = parentId }}
        onDragOver={e => {
          e.preventDefault()
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
          setDragOver(e.clientY < rect.top + rect.height / 2 ? 'before' : 'after')
        }}
        onDragLeave={() => setDragOver(null)}
        onDrop={e => {
          e.preventDefault()
          setDragOver(null)
          if (!dragNode || dragNode._id === node._id) return
          if (dragParentId !== parentId) return // only reorder within same parent
          const fromIdx = siblings.findIndex(s => s._id === dragNode!._id)
          let toIdx = dragOver === 'before' ? sibIdx : sibIdx + 1
          if (fromIdx < toIdx) toIdx--
          if (fromIdx !== toIdx) onReorder(parentId, fromIdx, toIdx)
        }}
        onDragEnd={() => { dragNode = null; dragParentId = null; setDragOver(null) }}
        onClick={() => onSelect(node._id)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 10px 5px ' + (indent + 10) + 'px',
          cursor: 'pointer', userSelect: 'none',
          background: isSelected ? 'var(--accent-dim)' : 'transparent',
          borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
          borderBottom: '1px solid var(--border)',
          transition: 'background .1s',
        }}
        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.03)' }}
        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        {/* Expand toggle */}
        <button onClick={e => { e.stopPropagation(); setExpanded(x => !x) }}
          style={{ background:'none', border:'none', color:'var(--text-2)', cursor:'pointer', width:16, height:16, padding:0, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
          {node.children.length > 0
            ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                {expanded ? <path d="m18 15-6-6-6 6"/> : <path d="m6 9 6 6 6-6"/>}
              </svg>
            : <span style={{ width:10 }} />
          }
        </button>

        {/* Drag handle */}
        <span style={{ color:'var(--text-3)', cursor:'grab', fontSize:12, flexShrink:0 }}>⠿</span>

        {/* Visible indicator */}
        <span style={{ width:6, height:6, borderRadius:'50%', background: node.visible ? 'var(--accent)' : 'var(--red)', flexShrink:0 }} />

        {/* Label */}
        <span style={{ flex:1, fontSize:'0.72rem', fontWeight: depth === 0 ? 700 : 500, color: depth === 0 ? 'var(--text)' : 'var(--text-2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {node.label || "Untitled"}
        </span>

        {/* Child count badge */}
        {node.children.length > 0 && (
          <span style={{ fontSize:'0.55rem', color:'var(--text-3)', background:'var(--surface-2)', border:'1px solid var(--border)', padding:'1px 5px', borderRadius:10, flexShrink:0 }}>
            {node.children.length}
          </span>
        )}

        {/* Metadata type tag */}
        {node.metadata?.type && (
          <span style={{ fontSize:'0.52rem', color:'var(--blue)', background:'rgba(91,141,238,.1)', border:'1px solid rgba(91,141,238,.25)', padding:'1px 5px', borderRadius:4, flexShrink:0 }}>
            {String(node.metadata.type)}
          </span>
        )}

        {/* Add child button */}
        <button onClick={e => { e.stopPropagation(); onAdd(node._id) }}
          title="Add child" style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', padding:'2px 4px', borderRadius:3, flexShrink:0, fontSize:12, lineHeight:1 }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--accent)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'}>
          +
        </button>

        {/* Delete button */}
        <button onClick={e => { e.stopPropagation(); if (confirm(`Delete "${node.label}"?`)) onDelete(node._id, parentId) }}
          title="Delete" style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', padding:'2px 4px', borderRadius:3, flexShrink:0, fontSize:12, lineHeight:1 }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--red)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'}>
          ×
        </button>
      </div>

      {dragOver === 'after' && (
        <div style={{ height:2, background:'var(--accent)', margin:'1px 0', borderRadius:1 }} />
      )}

      {expanded && node.children.map((child, i) => (
        <NavNodeRow key={child._id} node={child} depth={depth+1} parentId={node._id}
          siblings={node.children} sibIdx={i}
          selected={selected} onSelect={onSelect} onUpdate={onUpdate}
          onReorder={onReorder} onDelete={onDelete} onAdd={onAdd} />
      ))}
    </div>
  )
}

// ─── Edit Panel ────────────────────────────────────────────────────────────
function EditPanel({ node, onUpdate }: { node: NavNode | null; onUpdate: (id: string, patch: Partial<NavNode>) => void }) {
  if (!node) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--text-3)', fontSize:'0.8rem', flexDirection:'column', gap:8 }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      Select an item to edit
    </div>
  )

  const field = (label: string, key: keyof NavNode, type: 'text'|'checkbox'|'textarea' = 'text') => (
    <div style={{ marginBottom:10 }}>
      <div style={{ fontSize:'0.56rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:4 }}>{label}</div>
      {type === 'checkbox'
        ? <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
            <input type="checkbox" checked={Boolean(node[key])} onChange={e => onUpdate(node._id, { [key]: e.target.checked } as Partial<NavNode>)}
              style={{ accentColor:'var(--accent)', width:14, height:14 }} />
            <span style={{ fontSize:'0.72rem', color:'var(--text-2)' }}>{Boolean(node[key]) ? 'Yes' : 'No'}</span>
          </label>
        : type === 'textarea'
          ? <textarea value={String(node[key] || '')} onChange={e => onUpdate(node._id, { [key]: e.target.value } as Partial<NavNode>)}
              style={{ width:'100%', background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:5, color:'var(--text)', fontFamily:'inherit', fontSize:'0.7rem', padding:'6px 8px', outline:'none', resize:'vertical', minHeight:70 }} />
          : <input type="text" value={String(node[key] || '')} onChange={e => onUpdate(node._id, { [key]: e.target.value } as Partial<NavNode>)}
              style={{ width:'100%', background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:5, color:'var(--text)', fontFamily:'inherit', fontSize:'0.7rem', padding:'6px 8px', outline:'none' }} />
      }
    </div>
  )

  const metaStr = JSON.stringify(node.metadata || {}, null, 2)

  return (
    <div style={{ padding:'1rem', overflowY:'auto', height:'100%' }}>
      <div style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--text-2)', marginBottom:12, paddingBottom:8, borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:6 }}>
        <span style={{ width:6, height:6, borderRadius:'50%', background: node.visible ? 'var(--accent)' : 'var(--red)', flexShrink:0 }} />
        Editing: {node.label || 'Untitled'}
      </div>
      {field('Label', 'label')}
      {field('Description', 'description', 'textarea')}
      {field('Link URL', 'link_url')}
      {field('Use Page Link', 'link_use_page', 'checkbox')}
      {field('Class Name', 'class_name')}
      {field('CDN Image ID', 'cdn_image_id')}
      {field('Nav Sequence', 'nav_sequence')}
      {field('Visible', 'visible', 'checkbox')}
      <div style={{ marginBottom:10 }}>
        <div style={{ fontSize:'0.56rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:4 }}>Disclaimer (HTML)</div>
        <textarea value={String(node.disclaimer || '')} onChange={e => onUpdate(node._id, { disclaimer: e.target.value })}
          style={{ width:'100%', background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:5, color:'var(--text)', fontFamily:'monospace', fontSize:'0.65rem', padding:'6px 8px', outline:'none', resize:'vertical', minHeight:60 }} />
      </div>
      <div style={{ marginBottom:10 }}>
        <div style={{ fontSize:'0.56rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:4 }}>Metadata (JSON)</div>
        <textarea defaultValue={metaStr} onBlur={e => {
          try { onUpdate(node._id, { metadata: JSON.parse(e.target.value) }) }
          catch { alert('Invalid JSON') }
        }}
          style={{ width:'100%', background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:5, color:'var(--text)', fontFamily:'monospace', fontSize:'0.65rem', padding:'6px 8px', outline:'none', resize:'vertical', minHeight:80 }} />
      </div>
    </div>
  )
}

// ─── Navigation Editor ────────────────────────────────────────────────────
function NavigationEditor() {
  const [nodes, setNodes] = useState<NavNode[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  const loadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const r = new FileReader()
    r.onload = ev => {
      try {
        const json = JSON.parse(ev.target!.result as string)
        const data = json.data || json
        setNodes(assignIds(Array.isArray(data) ? data : [data]))
        setSelected(null)
        showMsg(`✓ Loaded ${Array.isArray(data) ? data.length : 1} root items`)
      } catch { showMsg('✗ Invalid JSON file') }
    }
    r.readAsText(f)
    e.target.value = ''
  }

  const findAndUpdate = useCallback((nodes: NavNode[], id: string, patch: Partial<NavNode>): NavNode[] =>
    nodes.map(n => n._id === id ? { ...n, ...patch } : { ...n, children: findAndUpdate(n.children, id, patch) })
  , [])

  const findAndDelete = (nodes: NavNode[], id: string): NavNode[] =>
    nodes.filter(n => n._id !== id).map(n => ({ ...n, children: findAndDelete(n.children, id) }))

  const findAndAdd = (nodes: NavNode[], parentId: string | null, newNode: NavNode): NavNode[] => {
    if (parentId === null) return [...nodes, newNode]
    return nodes.map(n => n._id === parentId
      ? { ...n, children: [...n.children, newNode] }
      : { ...n, children: findAndAdd(n.children, parentId, newNode) }
    )
  }

  const reorderInParent = (nodes: NavNode[], parentId: string | null, from: number, to: number): NavNode[] => {
    if (parentId === null) {
      const arr = [...nodes]
      const [item] = arr.splice(from, 1)
      arr.splice(to, 0, item)
      return arr
    }
    return nodes.map(n => {
      if (n._id === parentId) {
        const arr = [...n.children]
        const [item] = arr.splice(from, 1)
        arr.splice(to, 0, item)
        return { ...n, children: arr }
      }
      return { ...n, children: reorderInParent(n.children, parentId, from, to) }
    })
  }

  const onUpdate = (id: string, patch: Partial<NavNode>) => setNodes(n => findAndUpdate(n, id, patch))
  const onDelete = (id: string, parentId: string | null) => { setNodes(n => findAndDelete(n, id)); if (selected === id) setSelected(null) }
  const onAdd = (parentId: string | null) => {
    const n: NavNode = { _id: mkId(), label: 'NEW ITEM', description: null, image_id: null, class_name: null, nav_sequence: 0, link_url: null, link_use_page: false, disclaimer: null, children: [], metadata: {}, visible: true, cdn_image_id: null }
    setNodes(ns => findAndAdd(ns, parentId, n))
    setSelected(n._id)
  }
  const onReorder = (parentId: string | null, from: number, to: number) => setNodes(n => reorderInParent(n, parentId, from, to))

  const exportJSON = () => {
    const out = JSON.stringify({ data: stripIds(nodes) }, null, 2)
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out], { type:'application/json' }))
    a.download = 'navigation_export_' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '.json'
    a.click(); showMsg('✓ Exported!')
  }

  // Flatten for search
  const flatten = (ns: NavNode[]): NavNode[] => ns.flatMap(n => [n, ...flatten(n.children)])
  const selectedNode = selected ? flatten(nodes).find(n => n._id === selected) || null : null

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', minHeight:0 }}>
      {/* Toolbar */}
      <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8, flexShrink:0, flexWrap:'wrap' }}>
        <input type="file" ref={fileRef} accept=".json" onChange={loadFile} style={{ display:'none' }} />
        <button onClick={() => fileRef.current?.click()} style={btnStyle('accent')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Import JSON
        </button>
        <button onClick={exportJSON} disabled={!nodes.length} style={btnStyle('ghost')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export JSON
        </button>
        <button onClick={() => onAdd(null)} style={btnStyle('ghost')}>+ Add Root Item</button>
        <div style={{ flex:1 }} />
        <div style={{ position:'relative' }}>
          <svg style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', color:'var(--text-3)', pointerEvents:'none' }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search labels…"
            style={{ paddingLeft:26, paddingRight:8, paddingTop:5, paddingBottom:5, background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:5, color:'var(--text)', fontFamily:'inherit', fontSize:'0.7rem', outline:'none', width:160 }} />
        </div>
        <span style={{ fontSize:'0.7rem', color:'var(--text-3)' }}>{nodes.length} root</span>
        {msg && <span style={{ fontSize:'0.68rem', color: msg.startsWith('✓') ? 'var(--accent)' : 'var(--red)' }}>{msg}</span>}
      </div>

      {/* Body: tree + edit panel */}
      <div style={{ display:'flex', flex:1, minHeight:0 }}>
        {/* Tree */}
        <div style={{ flex:'0 0 55%', borderRight:'1px solid var(--border)', overflowY:'auto' }}>
          {nodes.length === 0
            ? <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:200, gap:10, color:'var(--text-3)', fontSize:'0.8rem' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Import a navigation JSON to begin
              </div>
            : (search
                ? flatten(nodes).filter(n => n.label.toLowerCase().includes(search.toLowerCase())).map(n => (
                    <div key={n._id} onClick={() => setSelected(n._id)}
                      style={{ padding:'6px 12px', cursor:'pointer', borderBottom:'1px solid var(--border)', background: n._id === selected ? 'var(--accent-dim)' : 'transparent', fontSize:'0.72rem', color:'var(--text-2)' }}>
                      {n.label}
                    </div>
                  ))
                : nodes.map((n, i) => (
                    <NavNodeRow key={n._id} node={n} depth={0} parentId={null}
                      siblings={nodes} sibIdx={i} selected={selected}
                      onSelect={setSelected} onUpdate={onUpdate}
                      onReorder={onReorder} onDelete={onDelete} onAdd={onAdd} />
                  ))
              )
          }
        </div>

        {/* Edit panel */}
        <div style={{ flex:1, minWidth:0, overflow:'hidden' }}>
          <EditPanel node={selectedNode} onUpdate={onUpdate} />
        </div>
      </div>
    </div>
  )
}

// ─── Footer Editor ────────────────────────────────────────────────────────
interface FooterItem {
  _id: string
  [key: string]: unknown
}

function FooterEditor() {
  const [items, setItems] = useState<FooterItem[]>([])
  const [rawJson, setRawJson] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [view, setView] = useState<'list'|'raw'>('list')
  const fileRef = useRef<HTMLInputElement>(null)

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  const loadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const r = new FileReader()
    r.onload = ev => {
      try {
        const text = ev.target!.result as string
        setRawJson(text)
        const json = JSON.parse(text)
        const arr = Array.isArray(json) ? json : json.data || json.items || json.links || json.footer || [json]
        setItems(Array.isArray(arr) ? arr.map((i: unknown) => ({ ...i as object, _id: mkId() })) : [{ ...arr, _id: mkId() }])
        showMsg(`✓ Loaded ${Array.isArray(arr) ? arr.length : 1} items`)
      } catch { showMsg('✗ Invalid JSON file') }
    }
    r.readAsText(f)
    e.target.value = ''
  }

  const exportJSON = () => {
    const clean = items.map(({ _id, ...rest }) => rest)
    const out = JSON.stringify(clean, null, 2)
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out], { type:'application/json' }))
    a.download = 'footer_export_' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '.json'
    a.click(); showMsg('✓ Exported!')
  }

  const applyRaw = () => {
    try {
      const json = JSON.parse(rawJson)
      const arr = Array.isArray(json) ? json : json.data || json.items || [json]
      setItems(Array.isArray(arr) ? arr.map((i: unknown) => ({ ...i as object, _id: mkId() })) : [{ ...arr, _id: mkId() }])
      showMsg('✓ Applied')
    } catch { showMsg('✗ Invalid JSON') }
  }

  const editingItem = items.find(i => i._id === editingId) || null

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', minHeight:0 }}>
      {/* Toolbar */}
      <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8, flexShrink:0, flexWrap:'wrap' }}>
        <input type="file" ref={fileRef} accept=".json" onChange={loadFile} style={{ display:'none' }} />
        <button onClick={() => fileRef.current?.click()} style={btnStyle('accent')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Import JSON
        </button>
        <button onClick={exportJSON} disabled={!items.length} style={btnStyle('ghost')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export JSON
        </button>
        <button onClick={() => {
          const n: FooterItem = { _id: mkId(), label: 'New Item', url: '', visible: true }
          setItems(prev => [...prev, n]); setEditingId(n._id)
        }} style={btnStyle('ghost')}>+ Add Item</button>
        <div style={{ flex:1 }} />
        {/* View toggle */}
        <div style={{ display:'flex', gap:2, background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:5, padding:2 }}>
          {(['list','raw'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{ ...btnStyle(view===v ? 'accent' : 'ghost'), padding:'3px 10px', fontSize:'0.65rem' }}>{v}</button>
          ))}
        </div>
        {msg && <span style={{ fontSize:'0.68rem', color: msg.startsWith('✓') ? 'var(--accent)' : 'var(--red)' }}>{msg}</span>}
      </div>

      {view === 'raw' ? (
        <div style={{ flex:1, display:'flex', flexDirection:'column', padding:14, gap:10 }}>
          <div style={{ fontSize:'0.62rem', color:'var(--text-3)' }}>Paste or edit raw JSON below, then click Apply</div>
          <textarea value={rawJson} onChange={e => setRawJson(e.target.value)}
            style={{ flex:1, background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text)', fontFamily:'monospace', fontSize:'0.7rem', padding:10, outline:'none', resize:'none' }} />
          <button onClick={applyRaw} style={{ ...btnStyle('accent'), alignSelf:'flex-start' }}>Apply JSON</button>
        </div>
      ) : (
        <div style={{ display:'flex', flex:1, minHeight:0 }}>
          {/* Item list */}
          <div style={{ flex:'0 0 45%', borderRight:'1px solid var(--border)', overflowY:'auto' }}>
            {items.length === 0
              ? <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:200, gap:10, color:'var(--text-3)', fontSize:'0.8rem' }}>
                  Import a JSON file to see footer items
                </div>
              : items.map((item, idx) => (
                  <div key={item._id}
                    onClick={() => setEditingId(item._id)}
                    style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', cursor:'pointer', borderBottom:'1px solid var(--border)', background: editingId === item._id ? 'var(--accent-dim)' : 'transparent', borderLeft: editingId === item._id ? '2px solid var(--accent)' : '2px solid transparent' }}>
                    <span style={{ fontSize:'0.62rem', color:'var(--text-3)', fontVariantNumeric:'tabular-nums', minWidth:20 }}>{idx+1}</span>
                    <span style={{ flex:1, fontSize:'0.72rem', color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {String(item.label || item.title || item.name || item.text || Object.keys(item).filter(k=>k!=='_id')[0] || 'Item')}
                    </span>
                    {item.url || item.href || item.link
                      ? <span style={{ fontSize:'0.6rem', color:'var(--accent)', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {String(item.url || item.href || item.link)}
                        </span>
                      : null
                    }
                    <button onClick={e => { e.stopPropagation(); if (confirm('Delete?')) { setItems(p => p.filter(i => i._id !== item._id)); if (editingId === item._id) setEditingId(null) } }}
                      style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:13, padding:'0 2px' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--red)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'}>×</button>
                  </div>
                ))
            }
          </div>

          {/* Edit panel */}
          <div style={{ flex:1, minWidth:0, overflowY:'auto', padding:14 }}>
            {editingItem
              ? <GenericJsonEditor item={editingItem} onUpdate={patch => setItems(prev => prev.map(i => i._id === editingItem._id ? { ...i, ...patch } : i))} />
              : <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--text-3)', fontSize:'0.8rem' }}>Select an item to edit</div>
            }
          </div>
        </div>
      )}
    </div>
  )
}

function GenericJsonEditor({ item, onUpdate }: { item: FooterItem; onUpdate: (p: Partial<FooterItem>) => void }) {
  const keys = Object.keys(item).filter(k => k !== '_id')
  return (
    <div>
      <div style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--text-2)', marginBottom:12, paddingBottom:8, borderBottom:'1px solid var(--border)' }}>
        Edit Item
      </div>
      {keys.map(k => {
        const v = item[k]
        const type = typeof v
        return (
          <div key={k} style={{ marginBottom:10 }}>
            <div style={{ fontSize:'0.56rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:4 }}>{k}</div>
            {type === 'boolean'
              ? <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
                  <input type="checkbox" checked={Boolean(v)} onChange={e => onUpdate({ [k]: e.target.checked })}
                    style={{ accentColor:'var(--accent)', width:14, height:14 }} />
                  <span style={{ fontSize:'0.72rem', color:'var(--text-2)' }}>{Boolean(v) ? 'Yes' : 'No'}</span>
                </label>
              : type === 'object'
                ? <textarea defaultValue={JSON.stringify(v, null, 2)} onBlur={e => {
                    try { onUpdate({ [k]: JSON.parse(e.target.value) }) } catch { alert('Invalid JSON') }
                  }} style={{ width:'100%', background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:5, color:'var(--text)', fontFamily:'monospace', fontSize:'0.65rem', padding:'6px 8px', outline:'none', resize:'vertical', minHeight:60 }} />
                : <input type="text" value={String(v ?? '')} onChange={e => onUpdate({ [k]: e.target.value })}
                    style={{ width:'100%', background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:5, color:'var(--text)', fontFamily:'inherit', fontSize:'0.7rem', padding:'6px 8px', outline:'none' }} />
            }
          </div>
        )
      })}
      {/* Add new key */}
      <AddKeyRow onAdd={(k, v) => onUpdate({ [k]: v })} />
    </div>
  )
}

function AddKeyRow({ onAdd }: { onAdd: (k: string, v: unknown) => void }) {
  const [key, setKey] = useState('')
  const [val, setVal] = useState('')
  return (
    <div style={{ display:'flex', gap:6, marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)' }}>
      <input placeholder="new key" value={key} onChange={e => setKey(e.target.value)}
        style={{ flex:1, background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:5, color:'var(--text)', fontFamily:'inherit', fontSize:'0.7rem', padding:'5px 8px', outline:'none' }} />
      <input placeholder="value" value={val} onChange={e => setVal(e.target.value)}
        style={{ flex:1, background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:5, color:'var(--text)', fontFamily:'inherit', fontSize:'0.7rem', padding:'5px 8px', outline:'none' }} />
      <button onClick={() => { if (key) { onAdd(key, val); setKey(''); setVal('') } }} style={btnStyle('accent')}>Add</button>
    </div>
  )
}

// ─── Shared button style helper ───────────────────────────────────────────
function btnStyle(variant: 'accent'|'ghost'): React.CSSProperties {
  if (variant === 'accent') return {
    display:'inline-flex', alignItems:'center', gap:5, padding:'5px 12px',
    background:'var(--accent)', border:'none', borderRadius:5, color:'#061a0d',
    fontFamily:'inherit', fontSize:'0.68rem', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap'
  }
  return {
    display:'inline-flex', alignItems:'center', gap:5, padding:'5px 12px',
    background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:5, color:'var(--text-2)',
    fontFamily:'inherit', fontSize:'0.68rem', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap'
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────
export function CMSToolsPage() {
  const [tab, setTab] = useState<'nav'|'footer'>('nav')
  const TOP = 60

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', color:'var(--text)', display:'flex', flexDirection:'column' }}>
      <TopNav currentPage="cms-tools" />

      {/* Sub-tab bar */}
      <div style={{ position:'fixed', top:TOP, left:0, right:0, height:48, background:'rgba(10,11,13,.97)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', padding:'0 2rem', gap:8, zIndex:90, backdropFilter:'blur(12px)' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
        <span style={{ fontSize:'0.75rem', fontWeight:700, letterSpacing:'0.08em', color:'var(--text)', marginRight:12 }}>CMS Tools</span>
        {(['nav','footer'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding:'4px 14px', borderRadius:5, border:'1px solid', cursor:'pointer', fontFamily:'inherit', fontSize:'0.7rem', fontWeight:600, transition:'all .15s',
              background: tab === t ? 'var(--accent-dim)' : 'none',
              borderColor: tab === t ? 'rgba(0,208,132,.35)' : 'var(--border)',
              color: tab === t ? 'var(--accent)' : 'var(--text-2)' }}>
            {t === 'nav' ? '🌐 Navigation Editor' : '📋 Footer Editor'}
          </button>
        ))}
        <div style={{ flex:1 }} />
        <span style={{ fontSize:'0.6rem', color:'var(--text-3)' }}>Import JSON · Edit · Export JSON</span>
      </div>

      {/* Content */}
      <div style={{ marginTop: TOP + 48, flex:1, height:`calc(100vh - ${TOP+48}px)`, overflow:'hidden' }}>
        {tab === 'nav'    && <NavigationEditor />}
        {tab === 'footer' && <FooterEditor />}
      </div>
    </div>
  )
}
