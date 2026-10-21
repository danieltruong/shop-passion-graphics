import { useState } from 'react'
import ProductImage, { PLACEHOLDER_IMAGE } from './ProductImage'
import './ProductGallery.css'

// Remount with a new `key` per product so the selection resets.
export default function ProductGallery({ images = [], name }) {
  const [selected, setSelected] = useState(0)
  const photos = images.length > 0 ? images : [PLACEHOLDER_IMAGE]
  const alt = selected === 0 ? name : `${name} photo ${selected + 1}`

  return (
    <div className="gallery">
      <div className="gallery__main">
        <ProductImage className="gallery__img" src={photos[selected]} alt={alt} decoding="async" />
      </div>
      {photos.length > 1 && (
        <ul className="gallery__thumbs">
          {photos.map((src, i) => (
            <li key={`${i}-${src}`}>
              <button
                type="button"
                className="gallery__thumb"
                aria-pressed={i === selected}
                onClick={() => setSelected(i)}
              >
                <ProductImage src={src} alt="" loading="lazy" decoding="async" />
                <span className="visually-hidden">Show photo {i + 1}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
