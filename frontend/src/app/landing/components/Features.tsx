import {
  Users,
  UserCog,
  CalendarCheck,
  CreditCard,
  Dumbbell,
  BarChart3,
  Smartphone,
  Cloud,
} from 'lucide-react';

const features = [
  {
    icon: Users,
    title: 'Member Management',
    description: 'Complete member profiles, plan tracking, and automated renewals in one place.',
    color: 'text-link bg-link-soft border-blue-100',
  },
  {
    icon: UserCog,
    title: 'Trainer Management',
    description: 'Assign trainers, manage schedules, and track performance effortlessly.',
    color: 'text-foreground bg-canvas-soft-2 border-purple-100',
  },
  {
    icon: CalendarCheck,
    title: 'Attendance Tracking',
    description: 'QR code, manual, and facial recognition check-in options for flexibility.',
    color: 'text-primary bg-primary/5 border-primary/10',
  },
  {
    icon: CreditCard,
    title: 'Automated Billing',
    description: 'Razorpay & Stripe integration with invoices and payment reminders.',
    color: 'text-warning bg-warning-soft border-amber-100',
  },
  {
    icon: Dumbbell,
    title: 'Workout Plans',
    description: 'Create and assign personalized workout routines for every member.',
    color: 'text-error-deep bg-error-soft border-rose-100',
  },
  {
    icon: BarChart3,
    title: 'Analytics Dashboard',
    description: 'Revenue, attendance, and growth metrics with real-time insights.',
    color: 'text-cyan-600 bg-cyan-50 border-cyan-100',
  },
  {
    icon: Smartphone,
    title: 'Mobile Friendly',
    description: 'Fully responsive interface that works beautifully on any device.',
    color: 'text-link-deep bg-link-soft border-indigo-100',
  },
  {
    icon: Cloud,
    title: 'Cloud Based System',
    description: 'Access your gym data from anywhere, anytime. Always backed up.',
    color: 'text-teal-600 bg-teal-50 border-teal-100',
  },
];

export default function Features() {
  return (
    <section id="features" className="py-20 lg:py-28 bg-canvas">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm font-semibold text-link uppercase tracking-wider mb-3">
            Features
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold text-foreground tracking-tight">
            Everything you need to run your gym
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A complete toolkit designed for fitness studio owners who want to
            focus on what matters — their members.
          </p>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f) => (
            <div
              key={f.title}
              className="group p-6 bg-canvas rounded-lg border border-hairline hover:border-hairline hover:shadow-level-4 hover:shadow-gray-100/80 transition-all duration-medium hover:-translate-y-1"
            >
              <div
                className={`w-12 h-12 rounded-lg border flex items-center justify-center mb-4 ${f.color} transition-transform duration-medium group-hover:scale-110`}
              >
                <f.icon className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
