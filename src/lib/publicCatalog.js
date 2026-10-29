import { supabase } from './supabase';
import { createQueryResource } from './queryResource';

// Keep browsing payloads small. Checkout and cart still verify current stock.
const bouquetFields = 'id,name,price,images,category,stock,is_visible,is_featured,created_at';
const productFields = 'id,name,price,images,category,stock,is_visible,is_available,created_at';
const query = build => createQueryResource(async () => {
  const { data, error } = await build().abortSignal(AbortSignal.timeout(10000));
  if (error) throw error;
  return data || [];
});

export const publicCatalog = {
  bouquets: query(() => supabase.from('bouquets').select(bouquetFields).eq('is_visible', true).order('created_at', { ascending: false })),
  featured: query(() => supabase.from('bouquets').select(bouquetFields).eq('is_visible', true).eq('is_featured', true).order('created_at', { ascending: false }).limit(4)),
  reviews: query(() => supabase.from('reviews').select('id,name,message,rating,admin_reply,created_at').eq('is_displayed', true).order('created_at', { ascending: false }).limit(3)),
  products: query(() => supabase.from('other_products').select(productFields).eq('is_visible', true).order('created_at', { ascending: false })),
  flowers: query(() => supabase.from('flowers').select('*').eq('is_available', true).gt('stock', 0)),
  flowerColors: query(() => supabase.from('flower_colors').select('*').eq('is_available', true)),
  fillers: query(() => supabase.from('fillers').select('*').eq('is_available', true).gt('stock', 0)),
  fillerColors: query(() => supabase.from('filler_colors').select('*').eq('is_available', true)),
  wrappers: query(() => supabase.from('wrappers').select('*').eq('is_available', true)),
  wrapperColors: query(() => supabase.from('wrapper_colors').select('*').eq('is_available', true)),
  sizes: query(() => supabase.from('bouquet_sizes').select('*').eq('is_available', true).order('display_order', { ascending: true })),
  addons: query(() => supabase.from('bouquet_addons').select('*').eq('is_available', true).order('display_order', { ascending: true })),
};
