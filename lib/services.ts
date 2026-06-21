import { supabase } from '@/lib/supabase';
import type { StylistService } from '@/types';

function rowToService(row: any): StylistService {
  return {
    id: row.id,
    stylistId: row.stylist_id,
    name: row.name ?? '',
    description: row.description ?? '',
    durationMinutes: row.duration_minutes ?? 60,
    price: Number(row.price ?? 0),
    bufferBeforeMinutes: row.buffer_before_minutes ?? 0,
    bufferAfterMinutes: row.buffer_after_minutes ?? 0,
    active: row.active ?? true,
    sortOrder: row.sort_order ?? 0,
  };
}

/** A stylist's service menu. Pass `activeOnly` for the client-facing list. */
export async function fetchServices(
  stylistId: string,
  activeOnly = false,
): Promise<StylistService[]> {
  let q = supabase
    .from('stylist_services')
    .select('*')
    .eq('stylist_id', stylistId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (activeOnly) q = q.eq('active', true);
  const { data } = await q;
  return (data ?? []).map(rowToService);
}

export type ServiceInput = Omit<StylistService, 'id' | 'stylistId'>;

export async function createService(input: ServiceInput): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return;
  await supabase.from('stylist_services').insert({
    stylist_id: uid,
    name: input.name.trim(),
    description: input.description.trim(),
    duration_minutes: input.durationMinutes,
    price: input.price,
    buffer_before_minutes: input.bufferBeforeMinutes,
    buffer_after_minutes: input.bufferAfterMinutes,
    active: input.active,
    sort_order: input.sortOrder,
  });
}

export async function updateService(id: string, input: ServiceInput): Promise<void> {
  await supabase
    .from('stylist_services')
    .update({
      name: input.name.trim(),
      description: input.description.trim(),
      duration_minutes: input.durationMinutes,
      price: input.price,
      buffer_before_minutes: input.bufferBeforeMinutes,
      buffer_after_minutes: input.bufferAfterMinutes,
      active: input.active,
      sort_order: input.sortOrder,
    })
    .eq('id', id);
}

export async function deleteService(id: string): Promise<void> {
  await supabase.from('stylist_services').delete().eq('id', id);
}
