import Link from "next/link";
import { createServiceAction } from "@/app/services/actions";
import { ServiceForm } from "@/components/ServiceForm";

export default function NewServicePage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">New service</h1>
        <Link href="/services" className="text-sm underline">
          All services
        </Link>
      </div>
      <ServiceForm action={createServiceAction} submitLabel="Create service" />
    </div>
  );
}
