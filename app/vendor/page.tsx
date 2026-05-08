import { withAuth } from "@workos-inc/authkit-nextjs";

export default async function VendorDashboard() {
  const { user } = await withAuth();

  const cards = [
    { label: "Products", icon: "📦", value: "—", href: "/vendor/products" },
    { label: "Orders", icon: "🧾", value: "—", href: "/vendor/orders" },
    { label: "Payments", icon: "💳", value: "—", href: "/vendor/payments" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">
          Welcome back{user?.firstName ? `, ${user.firstName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-stone-500">{user?.email}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
          >
            <div className="text-2xl">{card.icon}</div>
            <p className="mt-3 text-sm font-medium text-stone-500">{card.label}</p>
            <p className="mt-1 text-3xl font-semibold text-stone-900">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-medium text-amber-900">Account setup required</p>
        <p className="mt-1 text-sm text-amber-700">
          Connect your store profile to start managing products and receiving payments.
        </p>
      </div>
    </div>
  );
}
