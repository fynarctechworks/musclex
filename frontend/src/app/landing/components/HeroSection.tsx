import Link from 'next/link';
import {
  BarChart3,
  Users,
  CreditCard,
  CalendarCheck,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export default function HeroSection() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/40 to-cyan-50/30" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-blue-100/40 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-cyan-100/30 to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left — Text */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 rounded-full">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-700">AI-Powered Platform</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-[1.1] tracking-tight">
              All-in-One Gym{' '}
              <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                Management
              </span>{' '}
              Software
            </h1>

            <p className="text-lg sm:text-xl text-gray-500 leading-relaxed max-w-xl">
              Manage members, trainers, payments, attendance and gym analytics
              from one powerful dashboard. Built for modern fitness businesses.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/onboarding"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-200 group"
              >
                Start Free Trial
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <button
                onClick={() => scrollTo('pricing')}
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-base font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 shadow-sm transition-all duration-200"
              >
                View Pricing
              </button>
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-6 pt-2">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 border-2 border-white flex items-center justify-center text-xs font-bold text-white"
                  >
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-500">
                <span className="font-semibold text-gray-900">500+</span> gyms already
                onboard
              </p>
            </div>
          </div>

          {/* Right — Dashboard Mockup */}
          <div className="relative lg:pl-8">
            <div className="relative bg-white rounded-2xl shadow-2xl shadow-gray-200/60 border border-gray-100 overflow-hidden">
              {/* Title Bar */}
              <div className="flex items-center gap-2 px-5 py-3.5 bg-gray-50/80 border-b border-gray-100">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <span className="ml-3 text-xs font-medium text-gray-400">FitSync Pro — Dashboard</span>
              </div>

              {/* Dashboard Content */}
              <div className="p-5 space-y-4">
                {/* KPI Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Members', value: '1,284', icon: Users, color: 'text-blue-600 bg-blue-50' },
                    { label: 'Revenue', value: '₹4.2L', icon: CreditCard, color: 'text-emerald-600 bg-emerald-50' },
                    { label: 'Check‑ins', value: '342', icon: CalendarCheck, color: 'text-amber-600 bg-amber-50' },
                    { label: 'Growth', value: '+18%', icon: BarChart3, color: 'text-purple-600 bg-purple-50' },
                  ].map((kpi) => (
                    <div key={kpi.label} className="p-3 bg-gray-50/60 rounded-xl border border-gray-100">
                      <div className={`w-8 h-8 ${kpi.color} rounded-lg flex items-center justify-center mb-2`}>
                        <kpi.icon className="w-4 h-4" />
                      </div>
                      <p className="text-lg font-bold text-gray-900">{kpi.value}</p>
                      <p className="text-xs text-gray-400">{kpi.label}</p>
                    </div>
                  ))}
                </div>

                {/* Chart placeholder */}
                <div className="h-32 bg-gradient-to-t from-blue-50 to-transparent rounded-xl border border-gray-100 flex items-end px-4 pb-3 gap-2">
                  {[40, 65, 50, 80, 60, 90, 75, 95, 70, 85, 88, 92].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-md opacity-70"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Floating card */}
            <div className="absolute -bottom-5 -left-5 bg-white rounded-xl shadow-lg shadow-gray-200/50 border border-gray-100 p-4 hidden lg:flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                <CalendarCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Today&apos;s Check-ins</p>
                <p className="text-xs text-gray-400">342 members checked in</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
