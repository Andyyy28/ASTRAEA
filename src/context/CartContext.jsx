import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { readCart, writeCart, normalizeCartItem, newCartId } from '../lib/cartStorage';

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
  const [cartItems, setCartItems] = useState(readCart);
  const itemsRef = useRef(cartItems);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const commit = useCallback(items => { itemsRef.current = items; setCartItems(items); }, []);
  useEffect(() => { setStorageAvailable(writeCart(cartItems)); }, [cartItems]);

  const addToCart = useCallback(async (item) => {
    const incoming = normalizeCartItem(item);
    if (!incoming) return { ok: false, reason: 'invalid-item' };
    const quantity = incoming.quantity;
    const incomingSignature = buildItemSignature(incoming);

    // Stock is advisory while browsing. The quote and checkout transaction
    // recheck availability atomically; cart edits never mutate inventory.
    if (incoming.item_type === 'bouquet' && incoming.bouquet_id) {
      const { data, error } = await supabase.from('bouquets').select('stock, is_visible').eq('id', incoming.bouquet_id).abortSignal(AbortSignal.timeout(10000)).maybeSingle();
      const stock = Number(data?.stock) || 0;
      if (error) return { ok: false, reason: 'unavailable' };
      if (!data?.is_visible || stock < quantity) return { ok: false, reason: 'out-of-stock', stock };
      const existing = itemsRef.current.filter(i => i.bouquet_id === incoming.bouquet_id).reduce((n, i) => n + i.quantity, 0);
      if (existing + quantity > stock) return { ok: false, reason: 'limit-reached', stock };
    }

    if (incoming.item_type === 'other_product' && incoming.other_product_id) {
      const { data, error } = await supabase
        .from('other_products')
        .select('stock, is_available, is_visible')
        .eq('id', incoming.other_product_id)
        .abortSignal(AbortSignal.timeout(10000))
        .single();

      const availableStock = Number(data?.stock) || 0;
      if (error) return { ok: false, reason: 'unavailable' };
      if (!data || !data.is_available || !data.is_visible || availableStock <= 0) {
        return { ok: false, reason: 'out-of-stock', stock: availableStock };
      }

      const alreadyInCart = itemsRef.current
        .filter(current => current.item_type === 'other_product' && current.other_product_id === incoming.other_product_id)
        .reduce((total, current) => total + (Number(current.quantity) || 1), 0);

      if (alreadyInCart + quantity > availableStock) {
        return { ok: false, reason: 'limit-reached', stock: availableStock };
      }
    }

    const prev = itemsRef.current;
    const existingIndex = prev.findIndex(current => buildItemSignature(current) === incomingSignature);
    if (existingIndex >= 0 && prev[existingIndex].quantity + quantity > 50) return { ok: false, reason: 'invalid-quantity' };
    if (existingIndex < 0 && prev.length >= 50) return { ok: false, reason: 'invalid-quantity' };
    commit(existingIndex >= 0
      ? prev.map((current, index) => index === existingIndex ? { ...current, quantity: current.quantity + quantity } : current)
      : [...prev, { ...incoming, cartId: newCartId() }]);

    return { ok: true };
  }, [commit]);

  const removeFromCart = useCallback(async (cartId) => {
    commit(itemsRef.current.filter(item => item.cartId !== cartId));
    return { ok: true };
  }, [commit]);

  const updateQuantity = useCallback(async (cartId, newQuantity) => {
    const item = itemsRef.current.find(current => current.cartId === cartId);
    if (!item) return { ok: false };

    newQuantity = Number(newQuantity);
    if (!Number.isInteger(newQuantity) || newQuantity > 50) return { ok: false, reason: 'invalid-quantity' };
    if (newQuantity < 1) {
      commit(itemsRef.current.filter(item => item.cartId !== cartId));
      return { ok: true };
    }

    if (newQuantity > item.quantity && item.item_type !== 'custom') {
      const { data, error } = await supabase
        .from(item.item_type === 'bouquet' ? 'bouquets' : 'other_products')
        .select('*')
        .eq('id', item.bouquet_id || item.other_product_id)
        .abortSignal(AbortSignal.timeout(10000))
        .single();

      const availableStock = Number(data?.stock) || 0;
      if (error) return { ok: false, reason: 'unavailable' };
      if (!data || data.is_available === false || !data.is_visible || availableStock <= 0) {
        return { ok: false, reason: 'out-of-stock', stock: availableStock };
      }

      const otherCartQuantity = itemsRef.current
        .filter(current => current.cartId !== cartId && current.item_type === item.item_type && (current.bouquet_id || current.other_product_id) === (item.bouquet_id || item.other_product_id))
        .reduce((total, current) => total + (Number(current.quantity) || 1), 0);

      if (otherCartQuantity + newQuantity > availableStock) {
        return { ok: false, reason: 'limit-reached', stock: availableStock };
      }
    }

    commit(itemsRef.current.map(item => item.cartId === cartId ? { ...item, quantity: newQuantity } : item));

    return { ok: true };
  }, [commit]);

  const clearCart = useCallback(() => commit([]), [commit]);

  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);

  return (
    <CartContext.Provider value={{
      cartItems,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      cartCount,
      cartTotal,
      storageAvailable
    }}>
      {children}
    </CartContext.Provider>
  );
};
