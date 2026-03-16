'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, LayoutDashboard, Users, UserPlus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { OnboardingLayout } from '@/components/onboarding/onboarding-layout';

export default function OnboardingCompletePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const studio = useAuthStore((s) => s.studio);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (!user) return;
    const step = user.onboarding_step;
    if (step && step !== 'complete') {
      const routes: Record<string, string> = {
        studio_info: '/onboarding/studio-info',
        setup_branches: '/onboarding/branches',
        setup_plans: '/onboarding/memberships',
        setup_staff: '/onboarding/staff',
        select_subscription: '/onboarding/subscription',
      };
      if (routes[step]) router.push(routes[step]);
    }
  }, [user, isAuthenticated, hasHydrated, router]);

  const slug = studio?.slug || '';

  return (
    <OnboardingLayout currentStep={7} maxWidth="460px">
      <div className="text-center py-6">
        <div className="flex justify-center mb-5">
          <div className="relative">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-primary" />
            </div>
            <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-bold">🎉</span>
            </div>
          </div>
        </div>

        <h1 className="text-[26px] font-bold text-foreground tracking-tight">
          Your gym is ready!
        </h1>
        <p className="mt-2 text-[13px] text-muted-foreground leading-relaxed max-w-xs mx-auto">
          {studio?.name || 'Your studio'} is all set up. Start managing your gym like a pro.
        </p>

        <div className="mt-8 space-y-3">
          <Button
            onClick={() => router.push(`/${slug}/dashboard`)}
            className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-[13px]"
          >
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Go to Dashboard
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => router.push(`/${slug}/members`)}
              className="h-10 text-[13px]"
            >
              <UserPlus className="h-3.5 w-3.5 mr-1.5" />
              Add Members
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/${slug}/staff`)}
              className="h-10 text-[13px]"
            >
              <Users className="h-3.5 w-3.5 mr-1.5" />
              Invite Staff
            </Button>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6">
          <h3 className="text-[13px] font-semibold text-foreground mb-3">What&apos;s next?</h3>
          <div className="space-y-2 text-left">
            {[
              { text: 'Add your first member', done: false },
              { text: 'Create class schedules', done: false },
              { text: 'Set up check-in methods', done: false },
              { text: 'Configure payment options', done: false },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  item.done ? 'bg-primary border-primary' : 'border-border'
                }`}>
                  {item.done && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                </div>
                <span className="text-[12px] text-muted-foreground">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </OnboardingLayout>
  );
}
