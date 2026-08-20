import { redirect } from 'next/navigation';

/**
 * `/training` has no screen of its own — see the note in `store/page.tsx`.
 * The breadcrumb on `/training/plans` and `/training/exercises` links here, so
 * this redirects to the section's default child instead of 404ing.
 */
export default function TrainingIndex({ params }: { params: { gymSlug: string } }) {
  redirect(`/${params.gymSlug}/training/plans`);
}
