import { supabase } from './supabase';

export const normalizeStock = (stock) => Math.max(0, Number(stock) || 0);

export const reserveBouquetStock = async (bouquetId, quantity = 1) => {
  const reserveQuantity = Math.max(1, Number(quantity) || 1);
  const { data, error } = await supabase.rpc('reserve_bouquet_stock', {
    p_bouquet_id: bouquetId,
    p_quantity: reserveQuantity
  });

  if (error) throw error;
  return data === null || data === undefined ? null : normalizeStock(data);
};

export const releaseBouquetStock = async (bouquetId, quantity = 1) => {
  const releaseQuantity = Math.max(1, Number(quantity) || 1);
  const { data, error } = await supabase.rpc('release_bouquet_stock', {
    p_bouquet_id: bouquetId,
    p_quantity: releaseQuantity
  });

  if (error) throw error;
  return data === null || data === undefined ? null : normalizeStock(data);
};
