import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useNotifications } from '../../context/NotificationContext';
import { Flower2, Trash2, Plus, Minus, ArrowRight } from 'lucide-react';

const Cart = () => {
  const { cartItems, updateQuantity, removeFromCart, cartTotal } = useCart();
  const { showToast } = useNotifications();
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  if (cartItems.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center py-20 bg-astraea-cream text-center px-4 animate-fade-in">
        <Flower2 className="w-24 h-24 text-astraea-pink/40 mb-6" />
        <h2 className="section-heading text-2xl md:text-4xl mb-4">Your cart is empty</h2>
        <p className="text-sm md:text-base text-astraea-darkgray/70 mb-8 max-w-md">Looks like you haven't added any beautiful everlasting bouquets to your cart yet.</p>
        <Link to="/shop" className="kawaii-btn-primary px-10 py-4 text-base md:text-lg">Start Shopping</Link>
      </div>
    );
  }

  const handleRemove = async (cartId) => {
    try {
      await removeFromCart(cartId);
    } catch (error) {
      console.error('Unable to release stock:', error);
      showToast({ type: 'error', title: 'Oops!', message: 'Could not update stock. Please try again.' });
    }
  };

  const handleQuantityChange = async (cartId, newQuantity) => {
    try {
      const result = await updateQuantity(cartId, newQuantity);
      if (result?.reason === 'out-of-stock') {
        showToast({
          type: 'error',
          title: 'Oops!',
          message: 'Sorry, this bouquet just went out of stock!'
        });
      }
    } catch (error) {
      console.error('Unable to update stock:', error);
      showToast({ type: 'error', title: 'Oops!', message: 'Could not update stock. Please try again.' });
    }
  };

  return (
    <div className="py-8 md:py-16 pb-28 lg:pb-16 bg-astraea-cream min-h-screen animate-fade-in">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="section-heading text-2xl md:text-4xl mb-8 md:mb-10">Your Cart</h1>
        <div className="flex flex-col lg:flex-row gap-10">
          <div className="lg:w-2/3 space-y-6">
            {cartItems.map((item) => (
              <div key={item.cartId} className="scrapbook-card washi-strip bg-[#FFFDFE] flex flex-col sm:flex-row gap-6 relative group transition-all">
                <button onClick={() => handleRemove(item.cartId)} className="absolute top-4 right-4 text-astraea-darkgray/40 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5" /></button>
                <div className="w-full sm:w-32 aspect-[4/3] sm:aspect-auto sm:h-32 bg-astraea-blush rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden border-2 border-dashed border-astraea-pink/30">
                  {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover object-center rounded-xl" /> : <Flower2 className="w-12 h-12 text-astraea-pink/40" />}
                </div>
                <div className="flex-grow flex flex-col justify-between">
                  <div>
                    <h3 className="font-heading font-bold text-xl text-astraea-darkgray mb-1 pr-8">{item.name}</h3>
                    <p className="inline-flex px-3 py-1 rounded-xl bg-[#FFF3CC] border-2 border-[#F9C74F] font-accent text-2xl text-[#8B6914] mb-3">₱{(item.price).toFixed(2)}</p>
                    {item.item_type === 'custom' && item.custom_details && (
                      <div className="text-sm text-astraea-darkgray/70 space-y-1 mb-4 bg-astraea-blush/30 p-3 rounded-xl border-2 border-dashed border-astraea-pink/20">
                        <p><span className="font-medium">Size:</span> {item.custom_details.size?.name}</p>
                        {item.custom_details.flowers?.map((f, i) => <p key={i}>• {f.quantity}x {f.name} {f.color ? `(${f.color})` : ''}</p>)}
                        {item.custom_details.fillers?.length > 0 && <p>• Fillers: {item.custom_details.fillers.map(f => f.name || f).join(', ')}</p>}
                        {item.custom_details.wrapper && <p>• Wrapper: {item.custom_details.wrapper.material} {item.custom_details.wrapper.color ? `(${item.custom_details.wrapper.color})` : ''}</p>}
                        {item.custom_details.addonDetails?.length > 0
                          ? item.custom_details.addonDetails.map(addon => <p key={addon.key}>• {addon.name}</p>)
                          : (
                            <>
                              {item.custom_details.addons?.ribbon && <p>• Premium Ribbon</p>}
                              {item.custom_details.addons?.messageCard && <p>• Message Card</p>}
                            </>
                          )}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between items-end mt-4 sm:mt-0">
                    <div className="flex items-center border-2 border-dashed border-astraea-pink/40 rounded-full bg-white shadow-[3px_3px_0px_#F9A8C9]">
                      <button onClick={() => handleQuantityChange(item.cartId, item.quantity - 1)} className="min-h-11 min-w-11 flex items-center justify-center text-astraea-darkgray hover:text-astraea-pink"><Minus className="w-4 h-4" /></button>
                      <span className="w-10 text-center font-bold text-sm">{item.quantity}</span>
                      <button onClick={() => handleQuantityChange(item.cartId, item.quantity + 1)} className="min-h-11 min-w-11 flex items-center justify-center text-astraea-darkgray hover:text-astraea-pink"><Plus className="w-4 h-4" /></button>
                    </div>
                    <div className="text-right">
                      <span className="text-sm text-astraea-darkgray/60 block mb-1">Subtotal</span>
                      <span className="font-accent text-3xl text-[#8B6914]">₱{((item.price) * item.quantity).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="lg:w-1/3">
            <div className="scrapbook-card washi-strip bg-[#FFFDFE] lg:sticky lg:top-28">
              <h3 className="section-heading text-2xl mb-6">Order Summary</h3>
              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-astraea-darkgray/80"><span>Items Subtotal</span><span className="font-medium">₱{cartTotal.toFixed(2)}</span></div>
                <div className="flex justify-between text-astraea-darkgray/80"><span>Delivery Fee</span><span className="font-medium italic text-sm">Calculated at checkout</span></div>
              </div>
              <div className="border-t border-dashed border-astraea-pink/30 pt-4 mb-8 flex justify-between items-end">
                <span className="font-bold text-lg">Total</span>
                <span className="inline-flex px-3 py-1 rounded-xl bg-[#FFF3CC] border-2 border-[#F9C74F] font-accent text-4xl text-[#8B6914]">₱{cartTotal.toFixed(2)}</span>
              </div>
              <button onClick={() => navigate('/checkout')} className="kawaii-btn-primary w-full min-h-11 flex items-center justify-center py-4 text-lg">Proceed to Checkout <ArrowRight className="w-5 h-5 ml-2" /></button>
              <Link to="/shop" className="block text-center mt-6 text-sm font-medium text-astraea-darkgray/60 hover:text-astraea-pink transition-colors">Continue Shopping</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
