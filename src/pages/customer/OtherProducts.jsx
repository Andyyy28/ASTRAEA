import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatPrice } from '../../lib/formatPrice';
import { useCart } from '../../context/CartContext';
import { useNotifications } from '../../context/NotificationContext';
import { Flower2, Filter } from 'lucide-react';
import Skeleton from '../../components/Skeleton';

const categories = [
  { key: 'All', label: 'All' },
  { key: 'keychain', label: 'Keychains' },
  { key: 'hair accessories', label: 'Hair Accessories' },
  { key: 'ornaments', label: 'Ornaments' },
  { key: 'other', label: 'Other' }
];

const categoryLabels = {
  keychain: 'Keychain',
  'hair accessories': 'Hair Accessories',
  ornaments: 'Ornaments',
  other: 'Other'
};

const getStock = (product) => Number(product.stock) || 0;

const OtherProducts = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const { addToCart } = useCart();
  const { showToast } = useNotifications();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setError('');

      const { data, error } = await supabase
        .from('other_products')
        .select('*')
        .eq('is_visible', true)
        .order('created_at', { ascending: false });

      if (error) {
        setError(error.message || 'Unable to load products right now.');
        setProducts([]);
        setFilteredProducts([]);
        setLoading(false);
        return;
      }

      if (data) {
        setProducts(data);
        setFilteredProducts(data);
      }
      setLoading(false);
    };

    fetchProducts();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('other-products-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'other_products' },
        (payload) => {
          setProducts(prev => {
            if (payload.eventType === 'DELETE') {
              return prev.filter(product => product.id !== payload.old?.id);
            }

            const nextProduct = payload.new;
            if (!nextProduct?.id) return prev;
            const exists = prev.some(product => product.id === nextProduct.id);
            if (!nextProduct.is_visible) {
              return prev.filter(product => product.id !== nextProduct.id);
            }

            return exists
              ? prev.map(product => product.id === nextProduct.id ? { ...product, ...nextProduct } : product)
              : [nextProduct, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const result = categoryFilter === 'All'
      ? products
      : products.filter(product => product.category === categoryFilter);
    setFilteredProducts(result);
  }, [categoryFilter, products]);

  const handleAddToCart = async (product) => {
    if (!product.is_available || getStock(product) === 0) {
      showToast({
        type: 'error',
        title: 'Oops!',
        message: 'Out of stock ✦'
      });
      return;
    }

    const result = await addToCart({
      item_type: 'other_product',
      other_product_id: product.id,
      name: product.name,
      price: product.price,
      image: product.images?.[0],
      quantity: 1,
      subtotal: product.price
    });

    if (result?.ok) {
      showToast({
        type: 'success',
        title: 'Added to cart! ♡',
        message: 'Your item has been added successfully.'
      });
    } else if (result?.reason === 'limit-reached') {
      showToast({
        type: 'error',
        title: 'Oops!',
        message: `Only ${result.stock} items available ✦`
      });
    } else if (result?.reason === 'out-of-stock') {
      showToast({
        type: 'error',
        title: 'Oops!',
        message: 'Out of stock ✦'
      });
    }
  };

  return (
    <div className="animate-fade-in py-8 md:py-16 bg-astraea-cream min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 md:mb-12">
          <h1 className="section-heading text-2xl md:text-4xl mb-4">✿ Other Products</h1>
          <p className="font-accent text-2xl text-astraea-rosegold">More handcrafted fuzzy wire creations ♡</p>
        </div>

        <div className="scrapbook-card mb-8 bg-[#FFFDFE]">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-5 h-5 text-astraea-pink mr-2" />
            {categories.map(category => (
              <button
                key={category.key}
                onClick={() => setCategoryFilter(category.key)}
                className={`kawaii-btn min-h-11 px-4 py-2 text-sm font-bold ${categoryFilter === category.key ? 'bg-astraea-pink text-white' : 'bg-white text-astraea-darkgray'}`}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="scrapbook-card overflow-hidden relative flex flex-col p-2 md:p-4 bg-[#FFFDFE] border-2 border-dashed border-astraea-pink shadow-[4px_4px_0px_#F9A8C9] space-y-3">
                <Skeleton className="w-full aspect-[3/4] rounded-[16px]" />
                <Skeleton className="w-3/4 h-5" />
                <Skeleton className="w-1/3 h-6 rounded-xl" />
                <div className="mt-auto space-y-2">
                  <Skeleton className="w-full h-9 rounded-full" />
                  <Skeleton className="w-full h-9 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="scrapbook-card flex flex-col items-center justify-center py-20 bg-[#FFFDFE]">
            <Flower2 className="w-16 h-16 text-astraea-pink/40 mb-4" />
            <h3 className="font-heading text-xl md:text-2xl text-astraea-darkgray">Products couldn't load</h3>
            <p className="text-astraea-darkgray/60 mt-2 text-center max-w-sm">{error}</p>
            <button onClick={() => window.location.reload()} className="kawaii-btn-primary mt-6 min-h-11 px-6 py-2 text-sm">
              Try Again
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="scrapbook-card flex flex-col items-center justify-center py-20 bg-[#FFFDFE]">
            <Flower2 className="w-16 h-16 text-astraea-pink/40 mb-4" />
            <h3 className="font-heading text-xl md:text-2xl text-astraea-darkgray">No products found</h3>
            <p className="text-astraea-darkgray/60 mt-2 text-center max-w-sm">
              We couldn't find any products matching your current filter.
            </p>
            <button onClick={() => setCategoryFilter('All')} className="kawaii-btn-primary mt-6 min-h-11 px-6 py-2 text-sm">
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 fade-in-content">
            {filteredProducts.map((product, index) => {
              const stock = getStock(product);
              const isOutOfStock = stock === 0 || product.is_available === false;

              return (
              <div
                key={product.id}
                className={`group scrapbook-card overflow-hidden relative flex flex-col p-2 md:p-4 ${index % 2 === 0 ? 'scrapbook-card-tilt-left' : 'scrapbook-card-tilt-right'} washi-strip bg-[#FFFDFE]`}
              >
                <div className="absolute top-2 left-2 right-2 z-10 flex flex-wrap gap-1">
                  <span className="kawaii-badge bg-[#E8D5F5] border-[#C9A8E8] text-[#7B4FA8] text-xs px-2 py-1">
                    {categoryLabels[product.category] || 'Other'}
                  </span>
                  {!isOutOfStock && (
                    <span className="kawaii-badge text-xs px-2 py-1 bg-[#D5F0E8] border-[#A8DFC9] text-[#1F5D46] shadow-[2px_2px_0px_#A8DFC9]">
                      Available ✿
                    </span>
                  )}
                </div>

                <div className="w-full aspect-[3/4] bg-astraea-blush flex items-center justify-center overflow-hidden rounded-[16px] relative">
                  {product.images?.[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover object-top rounded-[16px] transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <Flower2 className="w-12 h-12 text-astraea-pink/30" />
                  )}
                </div>

                <div className="p-2 md:p-4 flex flex-col flex-grow">
                  <h3 className="font-heading font-bold text-sm text-astraea-darkgray mb-2 line-clamp-1">{product.name}</h3>
                  <p className="inline-flex w-fit px-2 py-1 rounded-xl bg-[#FFF3CC] border-2 border-[#F9C74F] font-accent text-sm text-[#8B6914] mb-3">
                    {formatPrice(product.price)}
                  </p>
                  <div className="mt-auto flex flex-col space-y-2">
                    <button
                      onClick={() => handleAddToCart(product)}
                      disabled={isOutOfStock}
                      className="kawaii-btn-primary transform-gpu min-h-11 w-full py-1.5 text-center text-xs hover:-translate-y-1 hover:scale-[1.02] active:translate-y-[2px] active:scale-[0.98] disabled:bg-gray-200 disabled:border-gray-300 disabled:text-gray-500 disabled:shadow-[3px_3px_0px_#D1D5DB] disabled:hover:translate-y-0 disabled:hover:scale-100 disabled:cursor-not-allowed"
                    >
                      Add to Cart
                    </button>
                    <Link to={`/other-products/${product.id}`} className="kawaii-btn-outline transform-gpu min-h-11 w-full py-1.5 text-center text-xs hover:-translate-y-1 hover:scale-[1.02] active:translate-y-[2px] active:scale-[0.98]">
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default OtherProducts;
