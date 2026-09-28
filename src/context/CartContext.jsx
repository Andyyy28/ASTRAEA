import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
const CartContext = createContext();
export const useCart = () => useContext(CartContext);
const buildItemSignature = (item) => {
  if (item.item_type === 'custom') {
    return JSON.stringify({
      item_type: item.item_type,
      name: item.name,
      price: item.price,
      bouquet_id: item.bouquet_id || null,
      image: item.image || null,
      message_card: item.message_card || null,
      custom_details: item.custom_details || null,
    });
  }

  return JSON.stringify({
    item_type: item.item_type,
    bouquet_id: item.bouquet_id || null,
    other_product_id: item.other_product_id || null,
    name: item.name,
    price: item.price,
    image: item.image || null,
    message_card: item.message_card || null,
  });
};

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState(() => {
    try {
      // v2 abandons legacy browser reservations. Reconcile old stock with staff.
      const saved = JSON.parse(localStorage.getItem('astraea_cart_v2') || '[]');
      return Array.isArray(saved) ? saved.filter(i => i && Number.isInteger(i.quantity) && i.quantity > 0 && Number.isFinite(Number(i.price)) && Number(i.price) >= 0) : [];
    } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem('astraea_cart_v2', JSON.stringify(cartItems)); }
    catch { /* Cart still works in memory when browser storage is unavailable. */ }
  }, [cartItems]);
  const checkStock = async (item, quantity, excludeId) => {
    const isBouquet = item.item_type === 'bouquet';
    if (!isBouquet && item.item_type !== 'other_product') return { ok: true };
    const key = isBouquet ? 'bouquet_id' : 'other_product_id';
    const { data, error } = await supabase.from(isBouquet ? 'bouquets' : 'other_products')
      .select(isBouquet ? 'stock, is_visible' : 'stock, is_visible, is_available').eq('id', item[key]).single();
    if (error) throw error;
    const stock = Number(data?.stock) || 0;
    const existing = cartItems.filter(i => i.cartId !== excludeId && i[key] === item[key]).reduce((n, i) => n + i.quantity, 0);
    const ok = !!data?.is_visible && (isBouquet || data.is_available) && existing + quantity <= stock;
    return { ok, stock, ...(!ok ? { reason: existing + quantity > stock && stock > 0 ? 'limit-reached' : 'out-of-stock' } : {}) };
  };
  const addToCart = async (item) => {
    const quantity = Number(item.quantity || 1);
    if (!Number.isInteger(quantity) || quantity < 1) return { ok: false };
    const result = await checkStock(item, quantity);
    if (!result.ok) return result;
    setCartItems(prev => {
      const signature = buildItemSignature(item);
      const match = prev.find(i => buildItemSignature(i) === signature);
      return match ? prev.map(i => i.cartId === match.cartId ? { ...i, quantity: i.quantity + quantity } : i)
        : [...prev, { ...item, quantity, cartId: crypto.randomUUID() }];
    });
    return result;
  };
  const removeFromCart = async (cartId) => {
    setCartItems(prev => prev.filter(i => i.cartId !== cartId));
    return { ok: true };
  };
  const updateQuantity = async (cartId, quantity) => {
    if (!Number.isInteger(quantity)) return { ok: false };
    if (quantity < 1) return removeFromCart(cartId);
    const item = cartItems.find(i => i.cartId === cartId);
    if (!item) return { ok: false };
    const result = await checkStock(item, quantity, cartId);
    if (result.ok) setCartItems(prev => prev.map(i => i.cartId === cartId ? { ...i, quantity } : i));
    return result;
  };
  const clearCart = () => setCartItems([]);
  const cartCount = cartItems.reduce((n, i) => n + i.quantity, 0);
  const cartTotal = cartItems.reduce((n, i) => n + Number(i.price || 0) * i.quantity, 0);
  return <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, updateQuantity, clearCart, cartCount, cartTotal }}>{children}</CartContext.Provider>;
};
