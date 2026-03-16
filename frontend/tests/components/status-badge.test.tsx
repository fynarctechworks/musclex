import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '@/components/shared/status-badge';

describe('StatusBadge', () => {
  it('renders with variant prop', () => {
    render(<StatusBadge variant="active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders with status prop mapping', () => {
    render(<StatusBadge status="expiring_soon" />);
    expect(screen.getByText('Expiring Soon')).toBeInTheDocument();
  });

  it('renders custom label', () => {
    render(<StatusBadge variant="active" label="Custom Label" />);
    expect(screen.getByText('Custom Label')).toBeInTheDocument();
  });

  it('maps paid status to active variant', () => {
    render(<StatusBadge status="paid" />);
    expect(screen.getByText('Paid')).toBeInTheDocument();
  });

  it('maps cancelled status to expired variant', () => {
    render(<StatusBadge status="cancelled" />);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('defaults to pending variant for unknown status', () => {
    render(<StatusBadge status="unknown_status" />);
    expect(screen.getByText('Unknown Status')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<StatusBadge variant="active" className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
