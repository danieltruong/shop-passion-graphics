/** Shipped in public/, shown when a product has no image or its image fails to load. */
export const PLACEHOLDER_IMAGE = '/product_placeholder.svg'

// files.stripe.com links are account-scoped and can be rotated.
function fallBack(e) {
  if (e.currentTarget.src.endsWith(PLACEHOLDER_IMAGE)) return
  e.currentTarget.src = PLACEHOLDER_IMAGE
}

export default function ProductImage({ src, alt, ...props }) {
  return <img {...props} src={src || PLACEHOLDER_IMAGE} alt={alt} onError={fallBack} />
}
