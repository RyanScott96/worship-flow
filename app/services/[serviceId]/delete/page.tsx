import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteServiceAction } from "@/app/services/actions";
import { getServiceWithItems } from "@/lib/db/services";

export default async function DeleteServicePage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const { serviceId } = await params;
  const result = await getServiceWithItems(serviceId);
  if (!result) notFound();
  const { service, items } = result;

  const action = deleteServiceAction.bind(null, serviceId);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Delete &ldquo;{service.name}&rdquo;?</h1>
      <p className="text-sm text-black/70 dark:text-white/70">
        This deletes the service and{" "}
        {items.length === 1 ? "its 1 item" : `all ${items.length} of its items`}.
        The songs themselves are not affected. This cannot be undone.
      </p>
      <form action={action} className="flex gap-3">
        <button
          type="submit"
          className="rounded bg-red-600 px-4 py-2 text-sm text-white"
        >
          Delete permanently
        </button>
        <Link
          href={`/services/${serviceId}`}
          className="rounded border border-black/15 px-4 py-2 text-sm dark:border-white/20"
        >
          Cancel
        </Link>
      </form>
    </div>
  );
}
