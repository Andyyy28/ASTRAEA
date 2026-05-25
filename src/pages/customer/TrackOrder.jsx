import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Clock, Scissors, CheckCircle, Package, MessageCircle } from 'lucide-react';

const statuses = [
  { id: 'pending', label: 'Pending', icon: Clock },
  { id: 'being-made', label: 'Being Made', icon: Scissors },
  { id: 'ready', label: 'Ready', icon: CheckCircle },
  { id: 'completed', label: 'Completed', icon: Package }
];

const TrackOrder = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [verification, setVerification] = useState('');
  const [order, setOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTrack = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim() || !verification.trim()) return;

    setLoading(true);
    setError('');
    setOrder(null);
    setOrderItems([]);

    try {
      const { data, error: orderError } = await supabase.rpc('track_order', {
        p_reference: searchQuery,
        p_verification: verification
      });

      if (orderError) throw orderError;
      
      if (data) {
        setOrder(data.order);
        setOrderItems(data.items || []);
      } else {
        setError('No order found. Please check your reference number and contact detail.');
      }
    } catch (err) {
      console.error(err);
      setError('No order found. Please check your reference number and contact detail.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIndex = (status) => {
    if (status === 'cancelled') return -1;
    const index = statuses.findIndex(s => s.id === status);
    return index >= 0 ? index : 0;
  };

  return (
    <div className="py-20 bg-astraea-blush/20 min-h-[80vh] animate-fade-in">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-12">
          <h1 className="font-heading text-4xl md:text-5xl font-bold text-astraea-darkgray mb-4">
            Track Your Order
          </h1>
          <p className="text-lg text-astraea-darkgray/70">
            Enter your reference number and your email or phone number to check its status.
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-2xl mx-auto mb-16">
          <form onSubmit={handleTrack} className="space-y-4">
            <div className="flex relative shadow-lg rounded-full overflow-hidden">
              <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-astraea-darkgray/40" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Reference number, e.g. AC-2026-AB12CD34"
                className="block w-full pl-14 pr-6 py-5 border-none outline-none text-lg text-astraea-darkgray placeholder-astraea-darkgray/30"
                required
              />
            </div>
            <input
              type="text"
              value={verification}
              onChange={(e) => setVerification(e.target.value)}
              placeholder="Email address or contact number used at checkout"
              className="block w-full px-6 py-5 rounded-full shadow-lg border-none outline-none text-lg text-astraea-darkgray placeholder-astraea-darkgray/30"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-astraea-pink text-white rounded-full font-bold hover:bg-astraea-pink/90 transition-colors disabled:opacity-70 flex justify-center"
            >
              {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Track'}
            </button>
          </form>
          {error && (
            <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-center animate-fade-in">
              {error}
            </div>
          )}
        </div>

        {/* Results Area */}
        {order && (
          <div className="bg-white rounded-2xl shadow-sm border border-astraea-rosegold/20 overflow-hidden animate-fade-in">
            
            {/* Header Info */}
            <div className="p-8 border-b border-astraea-rosegold/20 bg-astraea-blush/30">
              <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
                <div>
                  <p className="text-sm font-bold text-astraea-darkgray/50 uppercase tracking-widest mb-1">Order Reference</p>
                  <h2 className="font-heading text-3xl font-bold text-astraea-pink">{order.reference_number}</h2>
                </div>
                <div className="md:text-right">
                  <p className="font-medium text-astraea-darkgray">Ordered by {order.customer_name}</p>
                  <p className="text-sm text-astraea-darkgray/60">on {new Date(order.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="p-8 md:p-12 border-b border-astraea-rosegold/20">
              {order.status === 'cancelled' ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                    <span className="text-2xl font-bold">X</span>
                  </div>
                  <h3 className="font-heading text-2xl font-bold text-astraea-darkgray">Order Cancelled</h3>
                  <p className="text-astraea-darkgray/60 mt-2">This order has been cancelled. Please contact us for more information.</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Progress Line */}
                  <div className="absolute top-1/2 left-0 w-full h-1 bg-astraea-rosegold/20 -translate-y-1/2 z-0 hidden md:block"></div>
                  
                  <div className="flex flex-col md:flex-row justify-between relative z-10 gap-8 md:gap-0">
                    {statuses.map((s, idx) => {
                      const currentIndex = getStatusIndex(order.status);
                      const isCompleted = idx <= currentIndex;
                      const isCurrent = idx === currentIndex;
                      
                      return (
                        <div key={s.id} className="flex md:flex-col items-center gap-4 md:gap-3 flex-1 md:text-center">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border-4 transition-all duration-500 ${
                            isCurrent ? 'bg-astraea-pink border-astraea-pink/30 text-white shadow-lg scale-110' 
                            : isCompleted ? 'bg-astraea-pink border-astraea-pink text-white'
                            : 'bg-white border-astraea-rosegold/30 text-astraea-darkgray/30'
                          }`}>
                            <s.icon className={`w-5 h-5 ${isCurrent && 'animate-pulse'}`} />
                          </div>
                          <div>
                            <h4 className={`font-bold ${isCompleted ? 'text-astraea-darkgray' : 'text-astraea-darkgray/40'}`}>
                              {s.label}
                            </h4>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Order Summary & Contact */}
            <div className="p-8 flex flex-col lg:flex-row gap-10 bg-white">
              <div className="lg:w-2/3">
                <h3 className="font-heading text-xl font-bold mb-6">Order Details</h3>
                <div className="space-y-4">
                  {orderItems.map(item => (
                    <div key={item.id} className="flex justify-between items-start border-b border-astraea-rosegold/10 pb-4">
                      <div>
                        <p className="font-bold text-astraea-darkgray">
                          {item.quantity}x {item.item_type === 'custom' ? 'Custom Bouquet' : 'Ready-Made Bouquet'}
                        </p>
                        {item.size && <p className="text-sm text-astraea-darkgray/70">Size: {item.size}</p>}
                      </div>
                      <span className="font-medium">₱{item.subtotal.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-astraea-darkgray/80 pt-2">
                    <span>Delivery Method</span>
                    <span className="capitalize font-medium">{order.delivery_method}</span>
                  </div>
                  <div className="flex justify-between items-end pt-4 border-t border-astraea-rosegold/20">
                    <span className="font-bold text-lg">Total</span>
                    <span className="font-bold text-2xl text-astraea-pink">₱{order.total_amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              <div className="lg:w-1/3 bg-astraea-blush/20 rounded-2xl p-6 border border-astraea-rosegold/20 flex flex-col justify-center text-center">
                <MessageCircle className="w-10 h-10 text-astraea-pink mx-auto mb-4" />
                <h3 className="font-bold mb-2">Have a question?</h3>
                <p className="text-sm text-astraea-darkgray/70 mb-6">Need to update your order or ask about the status?</p>
                <a 
                  href="https://wa.me/639123456789" 
                  target="_blank" 
                  rel="noreferrer"
                  className="px-6 py-3 bg-[#25D366] text-white rounded-full font-bold hover:bg-[#1ebe5d] transition-colors inline-flex justify-center items-center"
                >
                  Message on WhatsApp
                </a>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};

export default TrackOrder;
