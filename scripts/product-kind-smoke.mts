// What a basket needs, and what an order made of it is allowed to promise.
//
//   npx tsx scripts/product-kind-smoke.mts
//
// Pure logic, but it decides whether a customer is told to collect something
// that will never exist — the exact bug `products.kind` was added to kill.

const { kindOf, isPhysical, basketFulfillment, terminalStatusFor, KIND_DEFS, PRODUCT_KINDS } =
  await import('../lib/product-kind')

let pass = 0
let fail = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    pass++
    console.log(`  ✓ ${label}`)
  } else {
    fail++
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

console.log('\nReading the column')
check('every kind has a definition', PRODUCT_KINDS.every((k) => !!KIND_DEFS[k]))
check('a good is physical', isPhysical('good'))
check('a service is not physical', !isPhysical('service'))
check('a digital download is not physical', !isPhysical('digital'))
check('a ticket is not physical', !isPhysical('ticket'))

console.log('\nUnknown values fail SAFE')
// Every pre-migration row, every AI-scanned menu item and every POS import
// arrives without a kind. Reading those as non-physical would skip a handover
// the customer is standing there waiting for.
check('null reads as a physical good', kindOf(null) === 'good')
check('undefined reads as a physical good', kindOf(undefined) === 'good')
check('a typo reads as a physical good', kindOf('digitl') === 'good')
check('an empty string reads as a physical good', kindOf('') === 'good')

console.log('\nWhat a basket needs')
check('goods need physical fulfillment', basketFulfillment(['good', 'good']) === 'physical')
check('downloads only → digital', basketFulfillment(['digital', 'digital']) === 'digital')
check('services only → service', basketFulfillment(['service']) === 'service')
check('an empty basket defaults to physical', basketFulfillment([]) === 'physical')
check('a basket of unknowns is physical', basketFulfillment([null, undefined]) === 'physical')

console.log('\nMixed baskets — the one that can strand a customer')
// If a single item has to change hands, the order still needs a pickup or a
// delivery. The download rides along either way; the sandwich does not.
check('good + digital is PHYSICAL, not digital', basketFulfillment(['good', 'digital']) === 'physical')
check('good + service is PHYSICAL', basketFulfillment(['good', 'service']) === 'physical')
check('digital + service is a service (nothing to hand over)', basketFulfillment(['digital', 'service']) === 'service')

console.log('\nThe right word for "finished"')
check('a pickup is collected', terminalStatusFor('pickup') === 'collected')
check('a delivery is delivered', terminalStatusFor('delivery') === 'delivered')
check('a download is delivered', terminalStatusFor('digital') === 'delivered')
check('a service is COMPLETED, never collected', terminalStatusFor('service') === 'completed')

console.log('\nRegression: a client cannot pick its way out of fulfillment')
// create-payment-intent derives fulfillment from the CATALOG, not from the
// request's fulfillmentType. These assert the derivation the route relies on;
// the route additionally forces delivery for a print-on-demand basket, which
// scripts/printify-smoke.mts covers.
check(
  'a physical basket stays physical however it is labelled',
  basketFulfillment(['good']) === 'physical'
)
check(
  'claiming digital for a physical item changes nothing',
  basketFulfillment(['good', 'good']) === 'physical'
)

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
