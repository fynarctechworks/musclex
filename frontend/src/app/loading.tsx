import { Spinner } from "@/components/shared";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" label="Loading" />
        <p className="text-[13px] text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
