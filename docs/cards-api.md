# Kort og EU-priser

```js
import { getCard, searchCards } from '@/services/cards'

try {
  const results = await searchCards('Furret', { page: 1, pageSize: 20 })
  const card = await getCard('swsh3-136')
  const price = card.prices?.trend ?? null

  console.log(results, card.name, card.image)
  console.log(price === null ? 'Price unavailable' : `${price} EUR`)
} catch (error) {
  console.error(error.message) // Vis en fejlbesked i sidens UI.
}
```