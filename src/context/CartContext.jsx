import React, { createContext, useContext, useState, useEffect } from 'react';
import { reserveBouquetStock, releaseBouquetStock } from '../lib/bouquetStock';

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
      const saved = localStorage.getItem('astraea_cart');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.warn('Unable to load saved cart:', error);
      localStorage.removeItem('astraea_cart');
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('astraea_cart', JSON.stringify(cartItems));
  }, [cartItems]);

  const addToCart = async (item) => {
    const quantity = Math.max(1, Number(item.quantity) || 1);
    const incoming = {
      ...item,
      quantity,
      reserved_quantity: item.item_type === 'bouquet' ? quantity : 0
    };
    const incomingSignature = buildItemSignature(incoming);
    let newStock = null;

    if (incoming.item_type === 'bouquet' && incoming.bouquet_id) {
      newStock = await reserveBouquetStock(incoming.bouquet_id, quantity);
      if (newStock === null) {
        return { ok: false, reason: 'out-of-stock' };
      }
    }

    setCartItems(prev => {
      const existingIndex = prev.findIndex(current => buildItemSignature(current) === incomingSignature);

      if (existingIndex !== -1) {
        return prev.map((current, index) => (
          index === existingIndex
            ? {
                ...current,
                quantity: (current.quantity || 1) + quantity,
                reserved_quantity: (current.reserved_quantity || 0) + incoming.reserved_quantity
              }
            : current
        ));
      }

      return [...prev, { ...incoming, cartId: Date.now().toString() }];
    });

    return { ok: true, stock: newStock };
  };

  const removeFromCart = async (cartId) => {
    const item = cartItems.find(current => current.cartId === cartId);
    if (item?.item_type === 'bouquet' && item.bouquet_id && item.reserved_quantity > 0) {
      await releaseBouquetStock(item.bouquet_id, item.reserved_quantity);
    }
    setCartItems(prev => prev.filter(item => item.cartId !== cartId));
    return { ok: true };
  };

  const updateQuantity = async (cartId, newQuantity) => {
    const item = cartItems.find(current => current.cartId === cartId);
    if (!item) return { ok: false };

    if (newQuantity < 1) {
      if (item.item_type === 'bouquet' && item.bouquet_id && item.reserved_quantity > 0) {
        await releaseBouquetStock(item.bouquet_id, item.reserved_quantity);
      }
      setCartItems(prev => prev.filter(item => item.cartId !== cartId));
      return { ok: true };
    }

    const currentQuantity = item.quantity || 1;
    const difference = newQuantity - currentQuantity;
    const reservedQuantity = item.reserved_quantity || 0;
    let nextReservedQuantity = reservedQuantity;
    let newStock = null;

    if (item.item_type === 'bouquet' && item.bouquet_id && difference > 0) {
      newStock = await reserveBouquetStock(item.bouquet_id, difference);
      if (newStock === null) {
        return { ok: false, reason: 'out-of-stock' };
      }
      nextReservedQuantity = reservedQuantity + difference;
    }

    if (item.item_type === 'bouquet' && item.bouquet_id && difference < 0) {
      const releaseQuantity = Math.min(Math.abs(difference), reservedQuantity);
      if (releaseQuantity > 0) {
        newStock = await releaseBouquetStock(item.bouquet_id, releaseQuantity);
      }
      nextReservedQuantity = Math.max(0, reservedQuantity - releaseQuantity);
    }

    setCartItems(prev =>
      prev.map(item => item.cartId === cartId ? { ...item, quantity: newQuantity, reserved_quantity: nextReservedQuantity } : item)
    );

    return { ok: true, stock: newStock };
  };

  const clearCart = () => setCartItems([]);

  const cartCount = cartItems.reduce((total, item) => total + (item.quantity || 1), 0);
  const cartTotal = cartItems.reduce((total, item) => total + ((item.price || item.subtotal) * (item.quantity || 1)), 0);

  return (
    <CartContext.Provider value={{
      cartItems,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      cartCount,
      cartTotal
    }}>
      {children}
    </CartContext.Provider>
  );
};
