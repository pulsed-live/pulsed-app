export async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ', Atlanta, GA')}`,
    { headers: { 'User-Agent': 'Pulsed/1.0' } }
  )
  const data = await res.json()
  if (data && data[0]) {
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  }
  return null
}
