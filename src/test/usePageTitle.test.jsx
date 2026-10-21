import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import usePageTitle from '../hooks/usePageTitle'

describe('usePageTitle', () => {
  beforeEach(() => {
    document.title = 'before'
  })

  it('appends the site name to a page title', () => {
    renderHook(() => usePageTitle('About the shop'))
    expect(document.title).toBe('About the shop | shop.passion.graphics')
  })

  it('uses the site name alone when no title is given', () => {
    renderHook(() => usePageTitle())
    expect(document.title).toBe('shop.passion.graphics')
  })

  it('leaves the title alone for null', () => {
    renderHook(() => usePageTitle(null))
    expect(document.title).toBe('before')
  })

  it('updates when the title changes', () => {
    const { rerender } = renderHook(({ title }) => usePageTitle(title), { initialProps: { title: 'A' } })
    rerender({ title: 'B' })
    expect(document.title).toBe('B | shop.passion.graphics')
  })
})
