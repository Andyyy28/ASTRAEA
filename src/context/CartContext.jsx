import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

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
    // Basic implementation - we can add item merging logic later if needed
    setCartItems(prev => [...prev, { ...item, cartId: Date.now().toString() }]);
  };

  const removeFromCart = (cartId) => {
    setCartItems(prev => prev.filter(item => item.cartId !== cartId));
  };

  const updateQuantity = (cartId, newQuantity) => {
    if (newQuantity < 1) return;
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
