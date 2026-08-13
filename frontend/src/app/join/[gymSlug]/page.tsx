import { getPublicGym } from "@/features/public-portal/api";
import { GymPortal } from "@/features/public-portal/gym-portal";

/**
 * PUBLIC gym landing — server component fetches the gym payload (ISR 60 s)
 * and hands it to the interactive client portal. Unknown/suspended slugs get
 * a friendly not-found state (the backend 404s them).
 */
export default async function JoinGymPage({
  params,
}: {
  params: { gymSlug: string };
}) {
  let data = null;
  let loadError = false;

  try {
    data = await getPublicGym(params.gymSlug);
  } catch {
    loadError = true;
  }

  if (loadError) {
    return (
      <EmptyState
        title="Something went wrong"
        body="We couldn't load this gym right now. Please try again in a moment."
      />
    );
  }

  if (!data) {
    return (
      <EmptyState
        title="Gym not found"
        body="We couldn't find a gym at this link. Double-check the address, or ask the gym for their latest join link."
      />
    );
  }

  return <GymPortal slug={params.gymSlug} data={data} />;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-hairline bg-canvas-soft text-xl">
        🏋️
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {body}
      </p>
    </div>
  );
}
