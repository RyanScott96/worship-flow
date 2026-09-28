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
          className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
        >
          New service
        </Link>
      </div>

      {servicesList.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No services yet — plan the first one.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {servicesList.map((s) => (
            <li key={s.id} className="flex items-baseline justify-between gap-4 py-3">
              <Link
                href={`/services/${s.id}`}
                className="font-medium hover:underline"
              >
                {s.name}
              </Link>
              <span className="text-sm text-muted-foreground">
                {formatServiceDate(s.starts_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
