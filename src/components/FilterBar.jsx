import { useId } from 'react'
import { SORTS } from '../utils/catalog'
import './FilterBar.css'

/** Controlled: `category` null means All; every change goes out through the on* props. */
export default function FilterBar({
  categories = [],
  category = null,
  onCategoryChange,
  sort,
  onSortChange,
  count = 0,
}) {
  const id = useId()
  const chips = [{ value: null, label: 'All' }, ...categories.map((c) => ({ value: c, label: c }))]

  return (
    <div className="filter-bar bevel">
      {categories.length > 0 && (
        <div className="filter-bar__chips" role="group" aria-label="Filter by category">
          {chips.map(({ value, label }) => {
            const active = value === category
            return (
              <button
                key={value ?? ''}
                type="button"
                className={`filter-bar__chip ${active ? 'sunken filter-bar__chip--active' : 'bevel'}`}
                aria-pressed={active}
                onClick={() => onCategoryChange?.(value)}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

      <div className="filter-bar__controls">
        <span className="filter-bar__count" aria-live="polite">
          {count} {count === 1 ? 'item' : 'items'}
        </span>

        <span className="filter-bar__control">
          <label htmlFor={`${id}-sort`}>Sort:</label>
          <select
            id={`${id}-sort`}
            className="filter-bar__field sunken"
            value={sort}
            onChange={(e) => onSortChange?.(e.target.value)}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </span>
      </div>
    </div>
  )
}
