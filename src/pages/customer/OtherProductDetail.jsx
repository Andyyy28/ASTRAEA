import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useCart } from '../../context/CartContext';
import { useNotifications } from '../../context/NotificationContext';
import { ArrowLeft, Flower2, Plus, Minus } from 'lucide-react';

const categoryLabels = {
  keychain: 'Keychain',
  'hair accessories': 'Hair Accessories',
  ornaments: 'Ornaments',
  other: 'Other'
};

const getStock = (product) => Number(product?.stock) || 0;

const StockStatusBadge = ({ stock }) => {
  if (stock > 10) return <span className="inline-flex w-fit rounded-full border border-[#A8DFC9] bg-[#D5F0E8] px-3 py-1 text-sm font-bold text-[#2D7A5F]">✿ In Stock</span>;
  if (stock > 0) return <span className="inline-flex w-fit rounded-full border border-[#F9C74F] bg-[#FFF3CC] px-3 py-1 text-sm font-bold text-[#8B6914]">⚠ Only {stock} left!</span>;
  return <span className="inline-flex w-fit rounded-full border border-[#F9A8C9] bg-[#FDDDE6] px-3 py-1 text-sm font-bold text-[#C4658A]">✦ Out of Stock</span>;
};

const OtherProductDetail = () => {
  const { id } = useParams();
  const { addToCart } = useCart();
  const { showToast } = useNotifications();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [messageCard, setMessageCard] = useState('');
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  useEffect(() => {
    const fetchProduct = async () => {
      const { data, error } = await supabase
        .from('other_products')
        .select('*')
        .eq('id', id)
        .eq('is_visible', true)
        .single();

      if (data) setProduct(data); else console.error('Product not found', error);
      setLoading(false);
    };

    if (id) fetchProduct();
  }, [id]);

  useEffect(() => {
    if (!id) return undefined;

    const channel = supabase
      .channel(`other-product-detail-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'other_products', filter: `id=eq.${id}` },
        (payload) => {
          if (payload.eventType === 'DELETE' || !payload.new?.is_visible) {
            setProduct(null);
            return;
          }

          setProduct(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const handleAddToCart = async () => {
    const stock = getStock(product);
    if (!product.is_available || stock === 0) {
      showToast({
        type: 'error',
        title: 'Oops!',
        message: 'Out of stock ✦'
      });
      return;
    }

    if (quantity > stock) {
      showToast({ type: 'error', title: 'Oops!', message: `Only ${stock} items available ✦` });
      return;
    }

    const result = await addToCart({
      item_type: 'other_product',
      other_product_id: product.id,
      name: product.name,
      price: product.price,
      image: product.images?.[0],
      quantity,
      message_card: messageCard,
      subtotal: product.price * quantity
    });

    if (result?.ok) {
      showToast({
        type: 'success',
        title: 'Added to cart! ♡',
        message: 'Your item has been added successfully.'
      });
    } else if (result?.reason === 'limit-reached') {
      showToast({ type: 'error', title: 'Oops!', message: `Only ${result.stock} items available ✦` });
    } else if (result?.reason === 'out-of-stock') {
      showToast({ type: 'error', title: 'Oops!', message: 'Out of stock ✦' });
    }
  };

  if (loading) return <div className="min-h-screen py-8 md:py-20 bg-astraea-cream flex justify-center"><div className="w-16 h-16 border-4 border-astraea-pink border-t-transparent rounded-full animate-spin"></div></div>;
  if (!product) return <div className="min-h-screen py-20 flex flex-col items-center justify-center bg-astraea-cream text-center px-4"><Flower2 className="w-20 h-20 text-astraea-pink/50 mb-6" /><h2 className="section-heading text-2xl md:text-4xl mb-4">Product Not Found</h2><p className="text-sm md:text-base text-astraea-darkgray/70 mb-8">This product might have been removed or the link is invalid.</p><Link to="/other-products" className="kawaii-btn-primary min-h-11 px-8 py-3">Back to Other Products</Link></div>;

  const images = product.images?.length ? product.images : [];
  const stock = getStock(product);
  const isOutOfStock = !product.is_available || stock === 0;

  return (
    <div className="animate-fade-in py-8 md:py-16 bg-astraea-cream min-h-[80vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/other-products" className="inline-flex items-center text-astraea-darkgray hover:text-astraea-pink transition-colors mb-8 font-medium"><ArrowLeft className="w-5 h-5 mr-2" />Back to Other Products</Link>
        <div className="flex flex-col md:flex-row gap-8 md:gap-12">
          <div className="md:w-1/2 flex flex-col gap-4">
            <div className="scrapbook-card washi-strip aspect-[4/5] bg-astraea-blush rounded-2xl flex items-center justify-center overflow-hidden">
              {images[activeImage] ? <img src={images[activeImage]} alt={product.name} className="w-full h-full object-cover object-top rounded-[14px]" /> : <Flower2 className="w-32 h-32 text-astraea-pink/20" />}
            </div>
            {images.length > 1 && (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {images.map((img, idx) => (
                  <button key={idx} onClick={() => setActiveImage(idx)} className={`w-24 h-24 rounded-xl flex-shrink-0 overflow-hidden border-2 transition-all ${activeImage === idx ? 'border-astraea-pink opacity-100 shadow-[3px_3px_0px_#F9A8C9]' : 'border-dashed border-astraea-pink/30 opacity-60 hover:opacity-100'}`}>
                    <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover object-top rounded-xl" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="md:w-1/2 flex flex-col scrapbook-card washi-strip bg-[#FFFDFE]">
            <span className="kawaii-badge bg-[#E8D5F5] border-[#C9A8E8] text-[#7B4FA8] w-max mb-4">
              {categoryLabels[product.category] || 'Other'}
            </span>
            <h1 className="font-heading font-bold text-2xl md:text-4xl text-astraea-darkgray mb-4">{product.name}</h1>
            <p className="inline-flex w-fit px-3 py-1 rounded-xl bg-[#FFF3CC] border-2 border-[#F9C74F] font-accent text-4xl text-[#8B6914] mb-6">₱{Number(product.price).toFixed(2)}</p>
            <div className="mb-6"><StockStatusBadge stock={stock} /></div>
            <div className="prose prose-pink text-astraea-darkgray/80 mb-6 max-w-none"><p>{product.description}</p></div>
            <span className={`kawaii-badge w-max mb-6 ${isOutOfStock ? 'bg-[#FCE8EE] border-[#F4BFCF] text-[#C4658A]' : 'bg-[#D5F0E8] border-[#A8DFC9] text-[#1F5D46] shadow-[2px_2px_0px_#A8DFC9]'}`}>
              {isOutOfStock ? 'Out of Stock ✦' : 'Available ✿'}
            </span>
            <div className="space-y-6 mb-10">
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-[#C4658A] mb-2">Add a personal message ♡ (Optional)</label>
                <textarea id="message" rows="3" value={messageCard} onChange={(e) => setMessageCard(e.target.value)} placeholder="A sweet note for your gift..." className="kawaii-input min-h-[100px] resize-none"></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#C4658A] mb-2">Quantity</label>
                <div className="flex items-center border-2 border-dashed border-astraea-pink/40 rounded-full w-max bg-white shadow-[3px_3px_0px_#F9A8C9]">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="min-h-11 min-w-11 p-3 text-astraea-darkgray hover:text-astraea-pink"><Minus className="w-5 h-5" /></button>
                  <span className="w-12 text-center font-bold text-lg">{quantity}</span>
                  <button
                    onClick={() => {
                      if (quantity >= stock) {
                        showToast({ type: 'error', title: 'Oops!', message: `Only ${stock} items available ✦` });
                        return;
                      }
                      setQuantity(quantity + 1);
                    }}
                    disabled={isOutOfStock || quantity >= stock}
                    className="min-h-11 min-w-11 p-3 text-astraea-darkgray hover:text-astraea-pink disabled:text-gray-300 disabled:cursor-not-allowed"
                  ><Plus className="w-5 h-5" /></button>
                </div>
              </div>
            </div>
            <div className="mt-auto">
              <div className="flex justify-between items-center mb-6 pt-6 border-t-2 border-dashed border-astraea-pink/30">
                <span className="section-heading text-xl md:text-2xl">Total</span>
                <span className="inline-flex px-3 py-1 rounded-xl bg-[#FFF3CC] border-2 border-[#F9C74F] font-accent text-4xl text-[#8B6914]">₱{(product.price * quantity).toFixed(2)}</span>
              </div>
              <button onClick={handleAddToCart} disabled={isOutOfStock} className="kawaii-btn-primary w-full py-4 text-lg disabled:bg-gray-200 disabled:border-gray-300 disabled:text-gray-500 disabled:shadow-[3px_3px_0px_#D1D5DB] disabled:hover:translate-y-0 disabled:hover:scale-100 disabled:cursor-not-allowed">Add to Cart</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OtherProductDetail;
