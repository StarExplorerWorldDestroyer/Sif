import { formatCurrency } from '@/lib/format';
import { useProfile } from '@/store/profile';

/**
 * Returns a currency formatter that respects the user's chosen currency.
 * Usage: const money = useMoney(); money(45) -> "$45"
 */
export function useMoney() {
  const { profile } = useProfile();
  const currency = profile?.currency ?? 'USD';
  return (amount: number) => formatCurrency(amount, currency);
}
