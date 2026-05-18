import MemberSearch from './MemberSearch'

export default function VendorSetupPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Link your member profile</h1>
        <p className="mt-2 text-sm text-stone-500">
          Search for your business in the marketplace to connect your vendor account.
        </p>
      </div>
      <MemberSearch />
    </div>
  )
}
