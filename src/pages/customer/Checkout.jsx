import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { supabase } from '../../lib/supabase';
import { useNotifications } from '../../context/NotificationContext';
import { CheckCircle2, ShoppingBag, ArrowLeft, Truck, Store, CreditCard, Banknote } from 'lucide-react';

// Upload proof of payment to Supabase Storage, returns the public URL
const uploadPaymentProof = async (file) => {
  const fileName = `payment-proofs/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;

  const { error } = await supabase.storage
    .from('bouquets')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });
  if (error) {
    console.log(error);
    throw error;
  }

  const { data: urlData } = supabase.storage.from('bouquets').getPublicUrl(fileName);
  return urlData.publicUrl;
};

const Checkout = () => {
  const { cartItems, cartTotal, clearCart } = useCart();
  const [deliveryMethod, setDeliveryMethod] = useState('pickup');
  const [formData, setFormData] = useState({
    customer_name: '',
    contact_number: '',
    facebook_account: '',
    payment_method: '',
    delivery_address: '',
    preferred_date: '',
    preferred_time: '',
    special_notes: ''
  });
  const [paymentProofFile, setPaymentProofFile] = useState(null);
  const [paymentProofPreview, setPaymentProofPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(null);
  const [errors, setErrors] = useState({});
  const { showToast } = useNotifications();
  const deliveryFee = deliveryMethod === 'delivery' ? 80 : 0;
  const grandTotal = cartTotal + deliveryFee;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  useEffect(() => {
    if (orderPlaced) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [orderPlaced]);

  useEffect(() => {
    return () => {
      if (paymentProofPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(paymentProofPreview);
      }
    };
  }, [paymentProofPreview]);

  const handleInputChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors(prev => ({ ...prev, [e.target.name]: '' }));
  };

  const handlePaymentProofChange = (e) => {
    const file = e.target.files?.[0] || null;
    setPaymentProofFile(file);
    setErrors(prev => ({ ...prev, payment_proof: '' }));
    setPaymentProofPreview(file ? URL.createObjectURL(file) : '');
  };

  const validateForm = () => {
    const nextErrors = {};
    if (!formData.customer_name.trim()) nextErrors.customer_name = 'Full name is required.';
    if (!formData.contact_number.trim()) nextErrors.contact_number = 'Contact number is required.';
    if (!formData.facebook_account.trim()) nextErrors.facebook_account = 'Facebook account is required.';
    if (!formData.payment_method) nextErrors.payment_method = 'Payment method is required.';
    if (formData.payment_method === 'gcash' && !paymentProofFile) nextErrors.payment_proof = 'Proof of payment is required for GCash.';
    if (!formData.preferred_date) nextErrors.preferred_date = deliveryMethod === 'pickup' ? 'Pickup date is required.' : 'Delivery date is required.';
    if (deliveryMethod === 'pickup' && !formData.preferred_time) nextErrors.preferred_time = 'Pickup time is required.';
    if (deliveryMethod === 'delivery' && !formData.delivery_address.trim()) nextErrors.delivery_address = 'Delivery address is required.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cartItems.length === 0) return;
    if (!validateForm()) {
      showToast({
        type: 'error',
        title: 'Oops!',
        message: 'Please complete the required checkout details.'
      });
      return;
    }
    setLoading(true);
    try {
      let paymentProofUrl = null;
      if (formData.payment_method === 'gcash') {
        paymentProofUrl = await uploadPaymentProof(paymentProofFile);
      }

      const orderItems = cartItems.map(item => ({
        item_type: item.item_type,
        bouquet_id: item.bouquet_id || null,
        other_product_id: item.other_product_id || null,
        size: item.custom_details?.size?.id || null,
        flowers: item.custom_details?.flowers || null,
        fillers: item.custom_details?.fillers || null,
        wrapper: item.custom_details?.wrapper || null,
        addons: item.custom_details?.addons || null,
        message_card: item.message_card || item.custom_details?.message || null,
        quantity: item.quantity
      }));

      const { data, error } = await supabase.rpc('place_order', {
        p_order: {
          customer_name: formData.customer_name,
          contact_number: formData.contact_number,
          facebook_account: formData.facebook_account,
          payment_method: formData.payment_method,
          payment_proof_url: paymentProofUrl,
          delivery_method: deliveryMethod,
          delivery_address: deliveryMethod === 'delivery' ? formData.delivery_address : null,
          preferred_date: formData.preferred_date || null,
          preferred_time: formData.preferred_time || null,
          special_notes: formData.special_notes
        },
        p_items: orderItems
      });
      if (error) throw error;

      clearCart();
      setOrderPlaced(data.reference_number);
    } catch (error) {
      console.error('Error placing order:', error);
      showToast({
        type: 'error',
        title: 'Oops! ✦',
        message: error.message || 'There was an error placing your order. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-astraea-cream py-8 md:py-20 flex justify-center items-center px-4 animate-fade-in">
        <div className="scrapbook-card washi-strip max-w-2xl w-full p-8 md:p-12 text-center bg-[#FFFDFE]">
          <div className="w-24 h-24 bg-astraea-mint rounded-full flex items-center justify-center mx-auto mb-6 shadow-[4px_4px_0px_#A8DFC9] border-2 border-dashed border-astraea-mint">
            <CheckCircle2 className="w-12 h-12 text-[#2D7A5F]" />
          </div>
          <h1 className="section-heading text-2xl md:text-4xl mb-2">Order Placed!</h1>
          <p className="font-accent text-3xl text-astraea-rosegold mb-4">Thank you, {formData.customer_name}!</p>
          <div className="inline-block bg-[#FFF3CC] border-2 border-[#F9C74F] rounded-xl px-4 py-2 mb-8 shadow-[3px_3px_0px_#F9C74F]">
            <p className="text-sm text-[#8B6914] font-bold uppercase tracking-wide">Your Reference Number</p>
            <p className="font-accent text-4xl text-[#8B6914]">{orderPlaced}</p>
          </div>
          <p className="text-astraea-darkgray/80 mb-10 max-w-md mx-auto leading-relaxed">
            We've received your order and our artisans will begin preparing it soon. We will contact you at <span className="font-bold">{formData.contact_number}</span> to confirm the details and payment.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/track-order" className="kawaii-btn-primary px-8 py-3">Track My Order</Link>
            <Link to="/" className="kawaii-btn-outline px-8 py-3">Back to Home</Link>
          </div>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col justify-center items-center bg-astraea-cream">
        <p className="mb-4">Your cart is empty.</p>
        <Link to="/shop" className="kawaii-btn-outline">Go to Shop</Link>
      </div>
    );
  }

  const fieldClass = 'kawaii-input';
  const errorClass = 'mt-1 text-sm font-medium text-[#C4658A]';

  return (
    <div className="py-8 md:py-16 bg-astraea-cream min-h-screen animate-fade-in">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 md:mb-10 flex flex-col items-start gap-2 md:gap-3">
          <Link to="/cart" className="inline-flex w-fit items-center text-astraea-darkgray hover:text-astraea-pink transition-colors font-medium leading-none">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Cart
          </Link>
          <h1 className="section-heading block text-2xl md:text-4xl leading-tight">Checkout</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-8 lg:gap-10">
          <div className="lg:w-2/3 space-y-6 md:space-y-8 order-1 lg:order-1">
            <div className="scrapbook-card washi-strip bg-[#FFFDFE]">
              <h3 className="section-heading text-xl md:text-2xl mb-6">Delivery Method</h3>
              <div className="flex bg-astraea-blush/30 rounded-full p-1 border-2 border-dashed border-astraea-pink/30">
                <button type="button" onClick={() => setDeliveryMethod('pickup')} className={`kawaii-btn flex-1 ${deliveryMethod === 'pickup' ? 'bg-white text-astraea-pink' : 'bg-transparent text-astraea-darkgray/60 shadow-none border-transparent'}`}><Store className="w-5 h-5 mr-2" />Store Pickup</button>
                <button type="button" onClick={() => setDeliveryMethod('delivery')} className={`kawaii-btn flex-1 ${deliveryMethod === 'delivery' ? 'bg-white text-astraea-pink' : 'bg-transparent text-astraea-darkgray/60 shadow-none border-transparent'}`}><Truck className="w-5 h-5 mr-2" />Delivery</button>
              </div>
            </div>

            <div className="scrapbook-card washi-strip bg-[#FFFDFE] space-y-6">
              <h3 className="section-heading text-xl md:text-2xl mb-2">Contact Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><label className="block text-sm font-medium text-[#C4658A] mb-2">Full Name *</label><input type="text" name="customer_name" value={formData.customer_name} onChange={handleInputChange} className={fieldClass} placeholder="Jane Doe" />{errors.customer_name && <p className={errorClass}>{errors.customer_name}</p>}</div>
                <div><label className="block text-sm font-medium text-[#C4658A] mb-2">Contact Number *</label><input type="tel" name="contact_number" value={formData.contact_number} onChange={handleInputChange} className={fieldClass} placeholder="0912 345 6789" />{errors.contact_number && <p className={errorClass}>{errors.contact_number}</p>}</div>
              </div>
              <div><label className="block text-sm font-medium text-[#C4658A] mb-2">Facebook Account *</label><input type="text" name="facebook_account" value={formData.facebook_account} onChange={handleInputChange} className={fieldClass} placeholder="Paste your Facebook profile link or name" />{errors.facebook_account && <p className={errorClass}>{errors.facebook_account}</p>}</div>
            </div>

            <div className="scrapbook-card washi-strip bg-[#FFFDFE] space-y-6">
              <h3 className="section-heading text-xl md:text-2xl mb-2">Payment Method</h3>
              <div className="flex bg-astraea-blush/30 rounded-full p-1 border-2 border-dashed border-astraea-pink/30">
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, payment_method: 'gcash' }));
                    setErrors(prev => ({ ...prev, payment_method: '' }));
                  }}
                  className={`kawaii-btn flex-1 ${formData.payment_method === 'gcash' ? 'bg-white text-astraea-pink' : 'bg-transparent text-astraea-darkgray/60 shadow-none border-transparent'}`}
                >
                  <CreditCard className="w-5 h-5 mr-2" />
                  Pay Online (GCash)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, payment_method: 'cash' }));
                    setErrors(prev => ({ ...prev, payment_method: '' , payment_proof: '' }));
                  }}
                  className={`kawaii-btn flex-1 ${formData.payment_method === 'cash' ? 'bg-white text-astraea-pink' : 'bg-transparent text-astraea-darkgray/60 shadow-none border-transparent'}`}
                >
                  <Banknote className="w-5 h-5 mr-2" />
                  Pay with Cash
                </button>
              </div>
              {errors.payment_method && <p className={errorClass}>{errors.payment_method}</p>}
              {formData.payment_method === 'gcash' ? (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-white border-2 border-dashed border-astraea-pink/30 p-4">
                    {/* TODO: Replace with actual GCash QR code image path so it is easy to swap in the real QR image. */}
                    <img src="/gcash.jpeg" alt="GCash QR code" className="w-full max-w-sm mx-auto rounded-xl object-contain" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#C4658A] mb-2">Upload Proof of Payment *</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePaymentProofChange}
                      className="kawaii-input file:mr-4 file:rounded-full file:border-0 file:bg-astraea-pink file:px-4 file:py-2 file:font-bold file:text-white file:transition-colors file:hover:bg-astraea-rosegold"
                    />
                    {errors.payment_proof && <p className={errorClass}>{errors.payment_proof}</p>}
                  </div>
                  {paymentProofPreview && (
                    <div className="rounded-2xl bg-white border-2 border-dashed border-astraea-pink/30 p-4">
                      <img src={paymentProofPreview} alt="Proof of payment preview" className="w-full max-w-sm mx-auto rounded-xl object-contain" />
                    </div>
                  )}
                  <p className="text-sm text-astraea-darkgray/70 leading-relaxed">
                    Please screenshot this QR code and pay before your pickup/delivery date. Upload your proof of payment here.
                  </p>
                </div>
              ) : formData.payment_method === 'cash' ? (
                <p className="text-sm text-astraea-darkgray/70 leading-relaxed">
                  Payment will be collected upon pickup or delivery.
                </p>
              ) : null}
            </div>

            <div className="scrapbook-card washi-strip bg-[#FFFDFE] space-y-6">
              <h3 className="section-heading text-xl md:text-2xl mb-2">{deliveryMethod === 'pickup' ? 'Pickup Details' : 'Delivery Details'}</h3>
              {deliveryMethod === 'delivery' && <div><label className="block text-sm font-medium text-[#C4658A] mb-2">Delivery Address *</label><textarea name="delivery_address" rows="3" value={formData.delivery_address} onChange={handleInputChange} className="kawaii-input min-h-[100px] resize-none" placeholder="Complete address including landmarks"></textarea>{errors.delivery_address && <p className={errorClass}>{errors.delivery_address}</p>}</div>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><label className="block text-sm font-medium text-[#C4658A] mb-2">{deliveryMethod === 'pickup' ? 'Preferred Pickup Date *' : 'Preferred Delivery Date *'}</label><input type="date" name="preferred_date" value={formData.preferred_date} onChange={handleInputChange} className={fieldClass} />{errors.preferred_date && <p className={errorClass}>{errors.preferred_date}</p>}</div>
                {deliveryMethod === 'pickup' && <div><label className="block text-sm font-medium text-[#C4658A] mb-2">Preferred Time *</label><input type="time" name="preferred_time" value={formData.preferred_time} onChange={handleInputChange} className={fieldClass} />{errors.preferred_time && <p className={errorClass}>{errors.preferred_time}</p>}</div>}
              </div>
              <div><label className="block text-sm font-medium text-[#C4658A] mb-2">Special Instructions (Optional)</label><textarea name="special_notes" rows="2" value={formData.special_notes} onChange={handleInputChange} className="kawaii-input min-h-[100px] resize-none" placeholder="Any additional notes for us..."></textarea></div>
            </div>
          </div>

          <div className="lg:w-1/3 order-2 lg:order-2">
            <div className="scrapbook-card washi-strip bg-[#FFFDFE] lg:sticky lg:top-28">
              <h3 className="section-heading text-2xl mb-6">Order Summary</h3>
              <div className="space-y-4 mb-6 max-h-60 overflow-y-auto pr-2">
                {cartItems.map(item => (
                  <div key={item.cartId} className="flex justify-between items-start text-sm">
                    <div className="flex-grow pr-4">
                      <span className="font-bold text-astraea-darkgray">{item.quantity}x</span> {item.name}
                    </div>
                    <span className="font-accent text-2xl text-[#8B6914]">₱{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-4 mb-6 border-t border-dashed border-astraea-pink/30 pt-4">
                <div className="flex justify-between text-astraea-darkgray/80"><span>Items Subtotal</span><span className="font-medium">₱{cartTotal.toFixed(2)}</span></div>
                <div className="flex justify-between text-astraea-darkgray/80"><span>Delivery Fee</span><span className="font-medium">₱{deliveryFee.toFixed(2)}</span></div>
              </div>
              <div className="border-t border-dashed border-astraea-pink/30 pt-4 mb-8 flex justify-between items-end">
                <span className="font-bold text-xl">Total</span>
                <span className="inline-flex px-3 py-1 rounded-xl bg-[#FFF3CC] border-2 border-[#F9C74F] font-accent text-4xl text-[#8B6914]">₱{grandTotal.toFixed(2)}</span>
              </div>
              <button type="submit" disabled={loading} className="kawaii-btn-primary w-full min-h-11 py-4 text-lg disabled:opacity-70 disabled:hover:translate-y-0">
                {loading ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><ShoppingBag className="w-5 h-5 mr-2" />Place Order</>}
              </button>
              <p className="text-center text-xs text-astraea-darkgray/50 mt-4 px-2">By placing this order, you agree to our Terms of Service and Privacy Policy. Payment details will be sent after confirmation.</p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Checkout;
