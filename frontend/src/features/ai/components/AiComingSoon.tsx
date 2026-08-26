import { Sparkles } from "lucide-react";

/**
 * The AI advisor's not-yet-released state.
 *
 * Shown INSTEAD of the chat composer, never alongside it. A composer that
 * accepts a question and answers "coming soon" wastes the person's time and
 * reads as a broken feature; saying so before they type reads as a roadmap.
 *
 * Deliberately never mentions configuration or environment variables — those
 * are our problem, not the gym's, and nothing on this screen lets them act.
 */
export function AiComingSoon({
  title = "AI advisor — coming soon",
  description = "Ask-anything insights on revenue, retention and class demand are on the way. Every number they will draw on is already in your dashboards today.",
  className = "",
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center ${className}`}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="h-6 w-6 text-primary" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      <span className="mt-4 inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
        Coming soon
      </span>
    </div>
  );
}
