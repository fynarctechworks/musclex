import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KPICard } from '@/components/shared/kpi-card';
import { Users } from 'lucide-react';

describe('KPICard', () => {
  it('renders label and value', () => {
    render(<KPICard label="Active Members" value={150} icon={Users} />);
    expect(screen.getByText('Active Members')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('renders string value', () => {
    render(<KPICard label="Revenue" value="₹5,00,000" icon={Users} />);
    expect(screen.getByText('₹5,00,000')).toBeInTheDocument();
  });

  it('renders positive trend indicator', () => {
    render(
      <KPICard
        label="Members"
        value={200}
        icon={Users}
        trend={{ value: 12, isPositive: true }}
      />
    );
    expect(screen.getByText('+12%')).toBeInTheDocument();
  });

  it('renders negative trend indicator', () => {
    render(
      <KPICard
        label="Members"
        value={200}
        icon={Users}
        trend={{ value: 5, isPositive: false }}
      />
    );
    expect(screen.getByText('5%')).toBeInTheDocument();
  });

  it('renders without trend', () => {
    const { container } = render(
      <KPICard label="Check-ins" value={300} icon={Users} />
    );
    // No trend element should be present
    expect(container.querySelector('.bg-destructive\\/10')).toBeNull();
  });
});
