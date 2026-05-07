import { Star } from 'lucide-react';

const testimonials = [
  {
    quote: 'This software transformed how we run our gym. We went from spreadsheets to a fully automated system in one week.',
    name: 'Rajesh Sharma',
    role: 'Fitness Club Owner, Mumbai',
    rating: 5,
  },
  {
    quote: 'The attendance tracking and automated billing alone saved us 20 hours a week. Absolutely worth every rupee.',
    name: 'Priya Patel',
    role: 'CrossFit Studio, Bangalore',
    rating: 5,
  },
  {
    quote: 'Managing 3 branches was a nightmare before MuscleX. Now everything is in one dashboard. Game changer.',
    name: 'Arjun Mehta',
    role: 'FitZone Chain, Delhi',
    rating: 5,
  },
];

export default function Testimonials() {
  return (
    <section id="testimonials" className="py-20 lg:py-28 bg-gradient-to-b from-gray-50/80 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-3">
            Testimonials
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
            Loved by gym owners everywhere
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            Hear from fitness professionals who transformed their business.
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="flex flex-col p-7 bg-white rounded-2xl border border-gray-100 hover:shadow-lg hover:shadow-gray-100/60 transition-all duration-300 hover:-translate-y-1"
            >
              {/* Stars */}
              <div className="flex gap-1 mb-5">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>

              <blockquote className="text-base text-gray-600 leading-relaxed mb-6 flex-1">
                &ldquo;{t.quote}&rdquo;
              </blockquote>

              <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-400">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
