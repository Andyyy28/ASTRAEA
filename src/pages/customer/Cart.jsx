import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { Flower2, Trash2, Plus, Minus, ArrowRight } from 'lucide-react';

const Cart = () => {
  const { cartItems, updateQuantity, removeFromCart, cartTotal } = useCart();
  const navigate = useNavigate();

  if (cartItems.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center py-20 bg-astraea-blush/20 text-center px-4 animate-fade-in">
        <Flower2 className="w-24 h-24 text-astraea-pink/40 mb-6" />
        <h2 className="font-heading text-2xl md:text-4xl font-bold text-astraea-darkgray mb-4">Your cart is empty</h2>
        <p className="text-sm md:text-base text-astraea-darkgray/70 mb-8 max-w-md">
          Looks like you haven't added any beautiful everlasting bouquets to your cart yet.
        </p>
        <Link to="/shop" className="min-h-11 px-10 py-4 bg-astraea-pink text-white rounded-full font-bold text-base md:text-lg hover:bg-astraea-pink/90 transition-colors shadow-lg hover:-translate-y-1 transform">
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="py-8 md:py-16 pb-28 lg:pb-16 bg-astraea-blush/20 min-h-screen animate-fade-in">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <h1 className="font-heading text-2xl md:text-4xl font-bold text-astraea-darkgray mb-8 md:mb-10">Your Cart</h1>
        
        <div className="flex flex-col lg:flex-row gap-10">
          
          {/* Cart Items List */}
          <div className="lg:w-2/3 space-y-6">
            {cartItems.map((item) => (
              <div key={item.cartId} className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-astraea-rosegold/20 flex flex-col sm:flex-row gap-6 relative group transition-all hover:shadow-md">
                
                {/* Remove Button */}
                <button 
                  onClick={() => removeFromCart(item.cartId)}
                  className="absolute top-4 right-4 text-astraea-darkgray/40 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>

                {/* Image */}
                <div className="w-full sm:w-32 h-32 bg-astraea-blush rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden border border-astraea-rosegold/10">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <Flower2 className="w-12 h-12 text-astraea-pink/40" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-grow flex flex-col justify-between">
                  <div>
                    <h3 className="font-heading font-bold text-xl text-astraea-darkgray mb-1 pr-8">{item.name}</h3>
                    <p className="font-bold text-astraea-pink mb-3">₱{(item.price).toFixed(2)}</p>
                    
                    {/* Custom Details if any */}
                    {item.item_type === 'custom' && item.custom_details && (
                      <div className="text-sm text-astraea-darkgray/70 space-y-1 mb-4 bg-astraea-blush/30 p-3 rounded-lg border border-astraea-rosegold/10">
                        <p><span className="font-medium">Size:</span> {item.custom_details.size?.name}</p>
                        {item.custom_details.flowers?.map((f, i) => (
                          <p key={i}>• {f.quantity}x {f.name} {f.color ? `(${f.color})` : ''}</p>
                        ))}
                        {item.custom_details.fillers?.length > 0 && <p>• Fillers: {item.custom_details.fillers.join(', ')}</p>}
                        {item.custom_details.wrapper && <p>• Wrapper: {item.custom_details.wrapper.material} {item.custom_details.wrapper.color ? `(${item.custom_details.wrapper.color})` : ''}</p>}
                        {item.custom_details.addons?.ribbon && <p>• Premium Ribbon</p>}
                        {item.custom_details.addons?.messageCard && <p>• Message Card</p>}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-end mt-4 sm:mt-0">
                    {/* Stepper */}
                    <div className="flex items-center border border-astraea-rosegold/40 rounded-full bg-white">
                      <button 
                        onClick={() => updateQuantity(item.cartId, item.quantity - 1)}
                        className="min-h-11 min-w-11 flex items-center justify-center text-astraea-darkgray hover:text-astraea-pink"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-10 text-center font-bold text-sm">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.cartId, item.quantity + 1)}
                        className="min-h-11 min-w-11 flex items-center justify-center text-astraea-darkgray hover:text-astraea-pink"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="text-right">
                      <span className="text-sm text-astraea-darkgray/60 block mb-1">Subtotal</span>
                      <span className="font-bold text-lg text-astraea-darkgray">₱{((item.price) * item.quantity).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="lg:w-1/3">
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-md border border-astraea-rosegold/20 lg:sticky lg:top-28">
              <h3 className="font-heading text-2xl font-bold mb-6 border-b border-astraea-rosegold/20 pb-4">Order Summary</h3>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-astraea-darkgray/80">
                  <span>Items Subtotal</span>
                  <span className="font-medium">₱{cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-astraea-darkgray/80">
                  <span>Delivery Fee</span>
                  <span className="font-medium italic text-sm">Calculated at checkout</span>
                </div>
              </div>
              
              <div className="border-t border-astraea-rosegold/20 pt-4 mb-8 flex justify-between items-end">
                <span className="font-bold text-lg">Total</span>
                <span className="font-bold text-3xl text-astraea-pink">₱{cartTotal.toFixed(2)}</span>
              </div>
              
              <button 
                onClick={() => navigate('/checkout')}
                className="w-full min-h-11 flex items-center justify-center py-4 bg-astraea-pink text-white rounded-full font-bold text-lg hover:bg-astraea-pink/90 transition-colors shadow-lg hover:-translate-y-1 transform"
              >
                Proceed to Checkout <ArrowRight className="w-5 h-5 ml-2" />
              </button>
              
              <Link to="/shop" className="block text-center mt-6 text-sm font-medium text-astraea-darkgray/60 hover:text-astraea-pink transition-colors">
                Continue Shopping
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Cart;
