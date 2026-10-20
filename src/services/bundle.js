export function calculateBundle(lines) {
  if (!Array.isArray(lines) || !lines.length || lines.length > 10) throw new Error('Choose between 1 and 10 listings.')
  const sellerId = lines[0].listing.sellerId
  const delivery = lines[0].listing.delivery
  const ids = new Set()
  let subtotalCents = 0
  let shippingCents = 0
  let separateShippingCents = 0
  for (const { listing, quantity } of lines) {
    if (ids.has(listing.id)) throw new Error('A listing can only appear once.')
    ids.add(listing.id)
    if (listing.sellerId !== sellerId) throw new Error('Choose cards from the same seller.')
    if (listing.status !== 'active') throw new Error('A selected listing is no longer available.')
    if (listing.delivery !== delivery) throw new Error('Choose listings with the same delivery method.')
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > listing.quantity) throw new Error('Check the available quantities.')
    if (!['tracked', 'pickup'].includes(delivery) || !Number.isSafeInteger(listing.priceCents) || listing.priceCents <= 0 || !Number.isSafeInteger(listing.shippingCents) || listing.shippingCents < 0) {
      throw new Error('Invalid listing price or delivery.')
    }
    subtotalCents += listing.priceCents * quantity
    const shipping = delivery === 'pickup' ? 0 : listing.shippingCents
    shippingCents = Math.max(shippingCents, shipping)
    separateShippingCents += shipping
  }
  if (!Number.isSafeInteger(subtotalCents + shippingCents)) throw new Error('Total is too large.')
  return { sellerId, delivery, subtotalCents, shippingCents, totalCents: subtotalCents + shippingCents, savingCents: separateShippingCents - shippingCents }
}
