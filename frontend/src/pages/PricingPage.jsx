import React from 'react';
import { PricingCheckout } from '@/components/pricing/PricingCheckout';

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12" data-testid="pricing-page">
      <PricingCheckout />
    </div>
  );
}
