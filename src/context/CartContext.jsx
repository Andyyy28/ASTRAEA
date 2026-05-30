import React, { createContext, useContext, useState, useEffect } from 'react';

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

  const addToCart = (item) => {
    const incoming = { ...item, quantity: 1 };
    const incomingSignature = buildItemSignature(incoming);

    setCartItems(prev => {
      const existingIndex = prev.findIndex(current => buildItemSignature(current) === incomingSignature);

      if (existingIndex !== -1) {
        return prev.map((current, index) => (
          index === existingIndex
            ? { ...current, quantity: (current.quantity || 1) + 1 }
            : current
        ));
      }

      return [...prev, { ...incoming, cartId: Date.now().toString() }];
    });
  };

  const removeFromCart = (cartId) => {
    setCartItems(prev => prev.filter(item => item.cartId !== cartId));
  };

  const updateQuantity = (cartId, newQuantity) => {
    if (newQuantity < 1) {
      setCartItems(prev => prev.filter(item => item.cartId !== cartId));
      return;
    }

    setCartItems(prev =>
      prev.map(item => item.cartId === cartId ? { ...item, quantity: newQuantity } : item)
    );
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
