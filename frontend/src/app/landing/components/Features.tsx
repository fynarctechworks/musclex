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
    color: 'text-blue-600 bg-blue-50 border-blue-100',
  },
  {
    icon: UserCog,
    title: 'Trainer Management',
    description: 'Assign trainers, manage schedules, and track performance effortlessly.',
    color: 'text-purple-600 bg-purple-50 border-purple-100',
  },
  {
    icon: CalendarCheck,
    title: 'Attendance Tracking',
    description: 'QR code, manual, and facial recognition check-in options for flexibility.',
    color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
  },
  {
    icon: CreditCard,
    title: 'Automated Billing',
    description: 'Razorpay & Stripe integration with invoices and payment reminders.',
    color: 'text-amber-600 bg-amber-50 border-amber-100',
  },
  {
    icon: Dumbbell,
    title: 'Workout Plans',
    description: 'Create and assign personalized workout routines for every member.',
    color: 'text-rose-600 bg-rose-50 border-rose-100',
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
    color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
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
    <section id="features" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-3">
            Features
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
            Everything you need to run your gym
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            A complete toolkit designed for fitness studio owners who want to
            focus on what matters — their members.
          </p>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f) => (
            <div
              key={f.title}
              className="group p-6 bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-lg hover:shadow-gray-100/80 transition-all duration-300 hover:-translate-y-1"
            >
              <div
                className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-4 ${f.color} transition-transform duration-300 group-hover:scale-110`}
              >
                <f.icon className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
