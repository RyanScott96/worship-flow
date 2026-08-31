import Link from "next/link";
import { notFound } from "next/navigation";
import { updateServiceAction } from "@/app/services/actions";
import { getServiceWithItems } from "@/lib/db/services";
import { ServiceForm } from "@/components/ServiceForm";

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const { serviceId } = await params;
  const result = await getServiceWithItems(serviceId);
  if (!result) notFound();

  const action = updateServiceAction.bind(null, serviceId);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Edit service</h1>
        <Link href={`/services/${serviceId}`} className="text-sm underline">
          Back to service
        </Link>
      </div>
      <ServiceForm
        action={action}
        service={result.service}
        submitLabel="Save changes"
      />
    </div>
  );
}
