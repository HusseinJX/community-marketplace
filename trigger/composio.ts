import { task, schedules, logger } from '@trigger.dev/sdk'
import { syncVendorCatalog, getConnectedMemberIds } from '@/lib/composio-commerce'

// On-demand catalog sync for a single connected vendor.
//
// Triggered two ways:
//   • the vendor's "Sync Now" button (via app/api/vendor/composio)
//   • right after a vendor finishes the OAuth connect flow (on-connect)
//
// Wraps the same `syncVendorCatalog(memberId)` core the daily cron uses, so the
// sync logic lives in exactly one place.
export const syncVendorCatalogTask = task({
  id: 'sync-vendor-catalog',
  run: async (payload: { memberId: string }) => {
    const { memberId } = payload
    logger.info('Syncing vendor catalog', { memberId })
    const result = await syncVendorCatalog(memberId)
    logger.info('Vendor catalog synced', { memberId, ...result })
    return result
  },
})

// Daily catalog freshness sweep. Re-pulls every connected vendor's catalog so
// price/availability changes made in Shopify/Square land in the marketplace.
// Observable in the Trigger.dev dashboard (Schedules).
export const syncAllCatalogsTask = schedules.task({
  id: 'sync-all-catalogs',
  // 3am UTC daily.
  cron: '0 3 * * *',
  run: async () => {
    const memberIds = await getConnectedMemberIds()
    logger.info('Daily catalog sweep starting', { vendors: memberIds.length })

    let synced = 0
    let failed = 0
    for (const memberId of memberIds) {
      try {
        const result = await syncVendorCatalog(memberId)
        synced += result.synced
      } catch (err) {
        failed++
        logger.error('Vendor sync failed', {
          memberId,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    logger.info('Daily catalog sweep complete', { vendors: memberIds.length, synced, failed })
    return { vendors: memberIds.length, synced, failed }
  },
})
