import React from 'react'

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="field responsive-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

export function NumberField({
  label,
  value,
  step = 0.25,
  min,
  onChange,
}: {
  label: string
  value: number
  step?: number
  min?: number
  onChange: (value: number) => void
}) {
  return (
    <Field label={label}>
      <input type="number" value={Number.isFinite(value) ? value : 0} step={step} min={min} onChange={(event) => onChange(Number(event.target.value))} />
    </Field>
  )
}

export function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </Field>
  )
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

export function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="toggle-field">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

export function Metric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  return (
    <div className={`metric metric-row metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="form-grid">{children}</div>
}

export function ToolSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel-section tool-section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

export function CommandButton({
  children,
  icon,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: React.ReactNode
}) {
  return (
    <button {...props} className={`command-button ${props.className ?? ''}`.trim()}>
      {icon && <span className="command-button-icon" aria-hidden>{icon}</span>}
      <span>{children}</span>
    </button>
  )
}
