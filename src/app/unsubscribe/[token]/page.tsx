import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function unsubscribe(token: string) {
  const contact = await prisma.contact.findUnique({ where: { unsubToken: token } });
  if (!contact) return null;
  if (contact.status !== "UNSUBSCRIBED") {
    await prisma.contact.update({ where: { id: contact.id }, data: { status: "UNSUBSCRIBED" } });
  }
  return contact;
}

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const contact = await unsubscribe(token);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-md p-8 text-center">
        {contact ? (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl">✓</div>
            <h1 className="text-xl font-bold text-slate-900">You're unsubscribed</h1>
            <p className="mt-2 text-sm text-slate-500">
              {contact.email} will no longer receive emails from us.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-2xl">?</div>
            <h1 className="text-xl font-bold text-slate-900">Link not found</h1>
            <p className="mt-2 text-sm text-slate-500">
              This unsubscribe link is invalid or has expired.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
