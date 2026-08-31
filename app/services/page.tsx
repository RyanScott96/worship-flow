import Link from "next/link";
import { formatServiceDate } from "@/lib/church-time";
import { listServices } from "@/lib/db/services";

// DB-backed, no dynamic param — keep it off the build-time prerender path
// (the Vercel build has no DATABASE_URL).
export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const servicesList = await listServices();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Services</h1>
        <Link
          href="/services/new"
          className="rounded bg-foreground px-3 py-1.5 text-sm text-background"
        >
          New service
        </Link>
      </div>

      {servicesList.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">
          No services yet — plan the first one.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/10 dark:divide-white/15">
          {servicesList.map((s) => (
            <li key={s.id} className="flex items-baseline justify-between gap-4 py-3">
              <Link
                href={`/services/${s.id}`}
                className="font-medium hover:underline"
              >
                {s.name}
              </Link>
              <span className="text-sm text-black/60 dark:text-white/60">
                {formatServiceDate(s.starts_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
