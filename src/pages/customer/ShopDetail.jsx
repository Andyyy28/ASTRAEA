import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useCart } from '../../context/CartContext';
import { useNotifications } from '../../context/NotificationContext';
import { normalizeStock } from '../../lib/bouquetStock';
import { ArrowLeft, Flower2, Plus, Minus } from 'lucide-react';

const ShopDetail = () => {
  const { id } = useParams();
  const { addToCart } = useCart();
  const { showToast } = useNotifications();
  const [bouquet, setBouquet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [messageCard, setMessageCard] = useState('');
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  useEffect(() => {
    const fetchBouquet = async () => {
      const { data, error } = await supabase.from('bouquets').select('*').eq('id', id).single();
      if (data) setBouquet(data); else console.error('Bouquet not found', error);
      setLoading(false);
    };
    if (id) fetchBouquet();
  }, [id]);

  useEffect(() => {
    if (!id) return undefined;

    const channel = supabase
      .channel(`shop-detail-bouquet-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bouquets', filter: `id=eq.${id}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setBouquet(null);
            return;
          }

          setBouquet(payload.new);
          setQuantity(current => Math.min(current, Math.max(1, normalizeStock(payload.new?.stock))));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const handleAddToCart = async () => {
    if (normalizeStock(bouquet.stock) === 0 || quantity > normalizeStock(bouquet.stock)) {
      showToast({
        type: 'error',
        title: 'Oops!',
        message: 'Sorry, this bouquet just went out of stock!'
      });
      return;
    }

    let result;
    try {
      result = await addToCart({
      item_type: 'bouquet',
      bouquet_id: bouquet.id,
      name: bouquet.name,
      price: bouquet.price,
      image: bouquet.images?.[0],
      quantity,
      message_card: messageCard,
      subtotal: bouquet.price * quantity
      });
    } catch (error) {
      console.error('Stock reservation failed:', error);
      showToast({
        type: 'error',
        title: 'Oops!',
        message: 'Sorry, this bouquet just went out of stock!'
      });
      return;
    }

    if (!result?.ok) {
      showToast({
        type: 'error',
        title: 'Oops!',
        message: 'Sorry, this bouquet just went out of stock!'
      });
      setBouquet(prev => prev ? { ...prev, stock: 0 } : prev);
      return;
    }

    if (result.stock !== null && result.stock !== undefined) {
      setBouquet(prev => prev ? { ...prev, stock: result.stock } : prev);
      setQuantity(current => Math.min(current, Math.max(1, result.stock)));
    }

    showToast({
      type: 'success',
      title: 'Added to cart! ♡',
      message: 'Your item has been added successfully.'
    });
  };

  if (loading) return <div className="min-h-screen py-8 md:py-20 bg-astraea-cream flex justify-center"><div className="w-16 h-16 border-4 border-astraea-pink border-t-transparent rounded-full animate-spin"></div></div>;
  if (!bouquet) return <div className="min-h-screen py-20 flex flex-col items-center justify-center bg-astraea-cream text-center px-4"><Flower2 className="w-20 h-20 text-astraea-pink/50 mb-6" /><h2 className="section-heading text-2xl md:text-4xl mb-4">Bouquet Not Found</h2><p className="text-sm md:text-base text-astraea-darkgray/70 mb-8">This bouquet might have been removed or the link is invalid.</p><Link to="/shop" className="kawaii-btn-primary min-h-11 px-8 py-3">Back to Shop</Link></div>;

  const images = bouquet.images?.length ? bouquet.images : [];
  const stock = normalizeStock(bouquet.stock);
  const isOutOfStock = stock === 0;

  return (
    <div className="animate-fade-in py-8 md:py-16 bg-astraea-cream min-h-[80vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/shop" className="inline-flex items-center text-astraea-darkgray hover:text-astraea-pink transition-colors mb-8 font-medium"><ArrowLeft className="w-5 h-5 mr-2" />Back to Shop</Link>
        <div className="flex flex-col md:flex-row gap-8 md:gap-12">
          <div className="md:w-1/2 flex flex-col gap-4">
            <div className="scrapbook-card washi-strip aspect-[4/5] bg-astraea-blush rounded-2xl flex items-center justify-center overflow-hidden">
              {images[activeImage] ? <img src={images[activeImage]} alt={bouquet.name} className="w-full h-full object-cover rounded-[14px]" /> : <Flower2 className="w-32 h-32 text-astraea-pink/20" />}
            </div>
            {images.length > 1 && (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {images.map((img, idx) => (
                  <button key={idx} onClick={() => setActiveImage(idx)} className={`w-24 h-24 rounded-xl flex-shrink-0 overflow-hidden border-2 transition-all ${activeImage === idx ? 'border-astraea-pink opacity-100 shadow-[3px_3px_0px_#F9A8C9]' : 'border-dashed border-astraea-pink/30 opacity-60 hover:opacity-100'}`}>
                    <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover rounded-xl" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="md:w-1/2 flex flex-col">
            {bouquet.category && <span className="kawaii-badge bg-[#E8D5F5] border-[#C9A8E8] text-[#7B4FA8] w-max mb-4">★ {bouquet.category}</span>}
            <span className={`kawaii-badge w-max mb-4 ${isOutOfStock ? 'bg-[#FCE8EE] border-[#F4BFCF] text-[#C4658A]' : 'bg-[#FDDDE6] border-[#F9A8C9] text-[#C4658A]'}`}>
              {isOutOfStock ? 'Out of Stock' : `${stock} in stock`}
            </span>
            <h1 className="section-heading text-2xl md:text-4xl mb-4">{bouquet.name}</h1>
            <p className="inline-flex w-fit px-3 py-1 rounded-xl bg-[#FFF3CC] border-2 border-[#F9C74F] font-accent text-4xl text-[#8B6914] mb-6">₱{Number(bouquet.price).toFixed(2)}</p>
            <div className="prose prose-pink text-astraea-darkgray/80 mb-8 max-w-none"><p>{bouquet.description}</p></div>
            <div className="space-y-6 mb-10">
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-[#C4658A] mb-2">Add a personal message (Optional)</label>
                <textarea id="message" rows="3" value={messageCard} onChange={(e) => setMessageCard(e.target.value)} placeholder="Happy Anniversary..." className="kawaii-input min-h-[100px] resize-none"></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#C4658A] mb-2">Quantity</label>
                <div className="flex items-center border-2 border-dashed border-astraea-pink/40 rounded-full w-max bg-white shadow-[3px_3px_0px_#F9A8C9]">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="min-h-11 min-w-11 p-3 text-astraea-darkgray hover:text-astraea-pink"><Minus className="w-5 h-5" /></button>
                  <span className="w-12 text-center font-bold text-lg">{quantity}</span>
                  <button onClick={() => setQuantity(Math.min(stock, quantity + 1))} disabled={isOutOfStock || quantity >= stock} className="min-h-11 min-w-11 p-3 text-astraea-darkgray hover:text-astraea-pink disabled:text-gray-300 disabled:cursor-not-allowed"><Plus className="w-5 h-5" /></button>
                </div>
              </div>
            </div>
            <div className="mt-auto">
              <div className="flex justify-between items-center mb-6 pt-6 border-t-2 border-dashed border-astraea-pink/30">
                <span className="section-heading text-xl md:text-2xl">Total</span>
                <span className="inline-flex px-3 py-1 rounded-xl bg-[#FFF3CC] border-2 border-[#F9C74F] font-accent text-4xl text-[#8B6914]">₱{(bouquet.price * quantity).toFixed(2)}</span>
              </div>
              <button onClick={handleAddToCart} disabled={isOutOfStock} className="kawaii-btn-primary w-full py-4 text-lg disabled:bg-gray-200 disabled:border-gray-300 disabled:text-gray-500 disabled:shadow-[3px_3px_0px_#D1D5DB] disabled:hover:translate-y-0 disabled:hover:scale-100 disabled:cursor-not-allowed">Add to Cart</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShopDetail;
