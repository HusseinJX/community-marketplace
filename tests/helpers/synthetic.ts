import sharp from 'sharp'

// A clean, high-contrast menu image the vision model can read reliably.
export async function makeMenuPng(): Promise<Buffer> {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
    <rect width="800" height="600" fill="#ffffff"/>
    <text x="60" y="80" font-family="Arial" font-size="40" font-weight="bold" fill="#111">CAFE MENU</text>
    <text x="60" y="170" font-family="Arial" font-size="32" fill="#111">Latte .......................... $4.50</text>
    <text x="60" y="230" font-family="Arial" font-size="32" fill="#111">Cappuccino ................ $4.00</text>
    <text x="60" y="290" font-family="Arial" font-size="32" fill="#111">Blueberry Muffin ........ $3.25</text>
    <text x="60" y="350" font-family="Arial" font-size="32" fill="#111">Avocado Toast .......... $9.00</text>
    <text x="60" y="410" font-family="Arial" font-size="32" fill="#111">Iced Tea ..................... $2.75</text>
  </svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

// A synthetic "counter" with three clearly distinct, labeled products on a
// surface — enough for the model to return separate bounding boxes.
export async function makeCounterPng(): Promise<Buffer> {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="900" height="600">
    <rect width="900" height="600" fill="#e7e2d8"/>
    <rect x="0" y="430" width="900" height="170" fill="#cdbfa6"/>
    <!-- red mug -->
    <rect x="80" y="250" width="170" height="200" rx="20" fill="#c0392b"/>
    <text x="95" y="500" font-family="Arial" font-size="26" fill="#111">Red Mug</text>
    <!-- blue bottle -->
    <rect x="370" y="160" width="120" height="290" rx="40" fill="#2471a3"/>
    <text x="360" y="500" font-family="Arial" font-size="26" fill="#111">Blue Bottle</text>
    <!-- green box -->
    <rect x="640" y="290" width="200" height="160" fill="#27ae60"/>
    <text x="650" y="500" font-family="Arial" font-size="26" fill="#111">Green Box</text>
  </svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}
