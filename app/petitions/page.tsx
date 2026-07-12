import { PetitionsClient } from "@/components/petitions/PetitionsClient";

export const metadata = {
  title: "Petitions",
  description:
    "Local petitions and causes you can sign — support small businesses, renters, safer streets, schools, and your neighborhood.",
};

export default function PetitionsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 md:px-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-stone-900">Petitions & causes</h1>
        <p className="mt-1 text-sm text-stone-500">
          The local causes neighbors are organizing around — in one place, so you can find and sign
          them on your own time. No need to catch someone on the street.
        </p>
      </div>

      <PetitionsClient />
    </div>
  );
}
