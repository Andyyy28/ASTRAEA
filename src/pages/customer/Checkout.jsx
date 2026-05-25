import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { supabase } from '../../lib/supabase';
import { CheckCircle2, ShoppingBag, ArrowLeft, Truck, Store } from 'lucide-react';

const Checkout = () => {
  const { cartItems, cartTotal, clearCart } = useCart();
  const navigate = useNavigate();

  const [deliveryMethod, setDeliveryMethod] = useState('pickup');
  const [formData, setFormData] = useState({
    customer_name: '',
    contact_number: '',
    email: '',
    delivery_address: '',
    preferred_date: '',
    preferred_time: '',
    special_notes: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(null); // stores reference_number

  const deliveryFee = deliveryMethod === 'delivery' ? 80 : 0;
  const grandTotal = cartTotal + deliveryFee;

  // Generate a random reference number
  const generateReferenceNumber = () => {
    const random = Math.floor(1000 + Math.random() * 9000);
    return `AC-2024-${random}`;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cartItems.length === 0) return;
    
    setLoading(true);
    const refNumber = generateReferenceNumber();

    try {
      // 1. Insert into orders
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([{
          reference_number: refNumber,
          customer_name: formData.customer_name,
          contact_number: formData.contact_number,
          email: formData.email,
          order_type: cartItems.some(i => i.item_type === 'custom') ? 'custom' : 'ready-made',
          delivery_method: deliveryMethod,
          delivery_address: deliveryMethod === 'delivery' ? formData.delivery_address : null,
          preferred_date: formData.preferred_date || null,
          preferred_time: formData.preferred_time || null,
          special_notes: formData.special_notes,
          total_amount: grandTotal,
          status: 'pending',
          is_paid: false
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Insert into order_items
      const orderItemsToInsert = cartItems.map(item => ({
        order_id: orderData.id,
        item_type: item.item_type,
        bouquet_id: item.bouquet_id || null, // null for custom items that don't map to a ready-made bouquet
        size: item.custom_details?.size?.name || null,
        flowers: item.custom_details?.flowers || null,
        fillers: item.custom_details?.fillers || null,
        wrapper: item.custom_details?.wrapper || null,
        addons: item.custom_details?.addons || null,
        message_card: item.message_card || item.custom_details?.message || null,
        quantity: item.quantity,
        subtotal: item.subtotal * item.quantity
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsToInsert);

      if (itemsError) throw itemsError;

      // Success
      clearCart();
      setOrderPlaced(refNumber);
    } catch (error) {
      console.error('Error placing order:', error);
      alert('There was an error placing your order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // --- Order Confirmation Screen ---
  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-astraea-blush/20 py-20 flex justify-center items-center px-4 animate-fade-in">
        <div className="bg-white max-w-2xl w-full rounded-2xl shadow-xl border border-astraea-rosegold/20 p-8 md:p-12 text-center">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
          </div>
          
          <h1 className="font-heading text-4xl font-bold text-astraea-darkgray mb-2">Order Placed!</h1>
          <p className="text-xl text-astraea-darkgray/80 mb-8">Thank you, {formData.customer_name}!</p>
          
          <div className="bg-astraea-blush/40 border border-astraea-pink/20 rounded-xl p-6 mb-8">
            <p className="text-sm text-astraea-darkgray/60 uppercase tracking-widest font-bold mb-2">Your Reference Number</p>
            <p className="font-heading text-3xl font-bold text-astraea-pink tracking-wide">{orderPlaced}</p>
          </div>
          
          <p className="text-astraea-darkgray/80 mb-10 max-w-md mx-auto leading-relaxed">
            We've received your order and our artisans will begin preparing it soon. 
            We will contact you at <span className="font-bold">{formData.contact_number}</span> to confirm the details and payment.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/track-order" className="px-8 py-3 bg-astraea-pink text-white rounded-full font-bold hover:bg-astraea-pink/90 transition-colors shadow-md">
              Track My Order
            </Link>
            <Link to="/" className="px-8 py-3 bg-white text-astraea-darkgray border-2 border-astraea-rosegold/30 rounded-full font-bold hover:bg-astraea-blush transition-colors">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // --- Checkout Form Screen ---
  if (cartItems.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col justify-center items-center">
        <p className="mb-4">Your cart is empty.</p>
        <Link to="/shop" className="text-astraea-pink font-bold">Go to Shop</Link>
      </div>
    );
  }

  return (
    <div className="py-12 bg-astraea-blush/10 min-h-screen animate-fade-in">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <Link to="/cart" className="inline-flex items-center text-astraea-darkgray hover:text-astraea-pink transition-colors mb-8 font-medium">
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Cart
        </Link>
        
        <h1 className="font-heading text-4xl font-bold text-astraea-darkgray mb-10">Checkout</h1>

        <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-10">
          
          {/* Left Column: Form */}
          <div className="lg:w-2/3 space-y-8">
            
            {/* Delivery Toggle */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-astraea-rosegold/20">
              <h3 className="font-heading text-2xl font-bold mb-6">Delivery Method</h3>
              <div className="flex bg-astraea-blush/30 rounded-full p-1 border border-astraea-rosegold/20">
                <button
                  type="button"
                  onClick={() => setDeliveryMethod('pickup')}
                  className={`flex-1 flex items-center justify-center py-3 px-6 rounded-full font-bold transition-all ${
                    deliveryMethod === 'pickup' ? 'bg-white shadow-sm text-astraea-pink border border-astraea-rosegold/10' : 'text-astraea-darkgray/60 hover:text-astraea-darkgray'
                  }`}
                >
                  <Store className="w-5 h-5 mr-2" /> Store Pickup
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryMethod('delivery')}
                  className={`flex-1 flex items-center justify-center py-3 px-6 rounded-full font-bold transition-all ${
                    deliveryMethod === 'delivery' ? 'bg-white shadow-sm text-astraea-pink border border-astraea-rosegold/10' : 'text-astraea-darkgray/60 hover:text-astraea-darkgray'
                  }`}
                >
                  <Truck className="w-5 h-5 mr-2" /> Delivery
                </button>
              </div>
            </div>

            {/* Contact Details */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-astraea-rosegold/20 space-y-6">
              <h3 className="font-heading text-2xl font-bold mb-2">Contact Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-astraea-darkgray mb-2">Full Name *</label>
                  <input 
                    type="text" 
                    name="customer_name"
                    required
                    value={formData.customer_name}
                    onChange={handleInputChange}
                    className="w-full border border-astraea-rosegold/40 rounded-xl p-3 focus:ring-2 focus:ring-astraea-pink outline-none bg-astraea-blush/20"
                    placeholder="Jane Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-astraea-darkgray mb-2">Contact Number *</label>
                  <input 
                    type="tel" 
                    name="contact_number"
                    required
                    value={formData.contact_number}
                    onChange={handleInputChange}
                    className="w-full border border-astraea-rosegold/40 rounded-xl p-3 focus:ring-2 focus:ring-astraea-pink outline-none bg-astraea-blush/20"
                    placeholder="0912 345 6789"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-astraea-darkgray mb-2">Email Address *</label>
                <input 
                  type="email" 
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full border border-astraea-rosegold/40 rounded-xl p-3 focus:ring-2 focus:ring-astraea-pink outline-none bg-astraea-blush/20"
                  placeholder="jane@example.com"
                />
              </div>
            </div>

            {/* Logistics Details */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-astraea-rosegold/20 space-y-6 animate-fade-in">
              <h3 className="font-heading text-2xl font-bold mb-2">
                {deliveryMethod === 'pickup' ? 'Pickup Details' : 'Delivery Details'}
              </h3>
              
              {deliveryMethod === 'delivery' && (
                <div>
                  <label className="block text-sm font-bold text-astraea-darkgray mb-2">Delivery Address *</label>
                  <textarea 
                    name="delivery_address"
                    required
                    rows="3"
                    value={formData.delivery_address}
                    onChange={handleInputChange}
                    className="w-full border border-astraea-rosegold/40 rounded-xl p-3 focus:ring-2 focus:ring-astraea-pink outline-none bg-astraea-blush/20 resize-none"
                    placeholder="Complete address including landmarks"
                  ></textarea>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-astraea-darkgray mb-2">
                    {deliveryMethod === 'pickup' ? 'Preferred Pickup Date *' : 'Preferred Delivery Date *'}
                  </label>
                  <input 
                    type="date" 
                    name="preferred_date"
                    required
                    value={formData.preferred_date}
                    onChange={handleInputChange}
                    className="w-full border border-astraea-rosegold/40 rounded-xl p-3 focus:ring-2 focus:ring-astraea-pink outline-none bg-astraea-blush/20"
                  />
                </div>
                {deliveryMethod === 'pickup' && (
                  <div>
                    <label className="block text-sm font-bold text-astraea-darkgray mb-2">Preferred Time *</label>
                    <input 
                      type="time" 
                      name="preferred_time"
                      required
                      value={formData.preferred_time}
                      onChange={handleInputChange}
                      className="w-full border border-astraea-rosegold/40 rounded-xl p-3 focus:ring-2 focus:ring-astraea-pink outline-none bg-astraea-blush/20"
                    />
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-bold text-astraea-darkgray mb-2">Special Instructions (Optional)</label>
                <textarea 
                  name="special_notes"
                  rows="2"
                  value={formData.special_notes}
                  onChange={handleInputChange}
                  className="w-full border border-astraea-rosegold/40 rounded-xl p-3 focus:ring-2 focus:ring-astraea-pink outline-none bg-astraea-blush/20 resize-none"
                  placeholder="Any additional notes for us..."
                ></textarea>
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary */}
          <div className="lg:w-1/3">
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-md border border-astraea-rosegold/20 sticky top-28">
              <h3 className="font-heading text-2xl font-bold mb-6 border-b border-astraea-rosegold/20 pb-4">Order Summary</h3>
              
              <div className="space-y-4 mb-6 max-h-60 overflow-y-auto pr-2">
                {cartItems.map(item => (
                  <div key={item.cartId} className="flex justify-between items-start text-sm">
                    <div className="flex-grow pr-4">
                      <span className="font-bold text-astraea-darkgray">{item.quantity}x</span> {item.name}
                    </div>
                    <span className="font-medium">₱{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-4 mb-6 border-t border-astraea-rosegold/20 pt-4">
                <div className="flex justify-between text-astraea-darkgray/80">
                  <span>Items Subtotal</span>
                  <span className="font-medium">₱{cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-astraea-darkgray/80">
                  <span>Delivery Fee</span>
                  <span className="font-medium">₱{deliveryFee.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="border-t border-astraea-rosegold/20 pt-4 mb-8 flex justify-between items-end">
                <span className="font-bold text-xl">Total</span>
                <span className="font-bold text-3xl text-astraea-pink">₱{grandTotal.toFixed(2)}</span>
              </div>
              
              <button 
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center py-4 bg-astraea-pink text-white rounded-full font-bold text-lg hover:bg-astraea-pink/90 transition-all shadow-lg hover:-translate-y-1 transform disabled:opacity-70 disabled:hover:translate-y-0"
              >
                {loading ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <ShoppingBag className="w-5 h-5 mr-2" /> Place Order
                  </>
                )}
              </button>
              <p className="text-center text-xs text-astraea-darkgray/50 mt-4 px-2">
                By placing this order, you agree to our Terms of Service and Privacy Policy. Payment details will be sent after confirmation.
              </p>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};

export default Checkout;
