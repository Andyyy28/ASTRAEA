import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useCart } from '../../context/CartContext';
import { Flower2, Filter } from 'lucide-react';

const Shop = () => {
  const [bouquets, setBouquets] = useState([]);
  const [filteredBouquets, setFilteredBouquets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sortOption, setSortOption] = useState('Newest');
  const { addToCart } = useCart();

  const categories = ['All', 'Romantic', 'Birthday', 'Graduation', 'Sympathy', 'Other'];

  useEffect(() => {
    const fetchBouquets = async () => {
      const { data } = await supabase
        .from('bouquets')
        .select('*')
        .eq('is_visible', true)
        .order('created_at', { ascending: false });

      if (data) {
        setBouquets(data);
        setFilteredBouquets(data);
      }
      setLoading(false);
    };

    fetchBouquets();
  }, []);

  useEffect(() => {
    let result = [...bouquets];
    if (categoryFilter !== 'All') {
      result = result.filter(b => b.category?.includes(categoryFilter));
    }
    if (sortOption === 'Price Low to High') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortOption === 'Price High to Low') {
      result.sort((a, b) => b.price - a.price);
    } else if (sortOption === 'Newest') {
      result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    setFilteredBouquets(result);
  }, [categoryFilter, sortOption, bouquets]);

  const handleAddToCart = (bouquet) => {
    addToCart({
      item_type: 'bouquet',
      bouquet_id: bouquet.id,
      name: bouquet.name,
      price: bouquet.price,
      image: bouquet.images?.[0],
      quantity: 1,
      subtotal: bouquet.price
    });
    alert('Added to cart!');
  };

  return (
    <div className="animate-fade-in py-8 md:py-16 bg-astraea-cream min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 md:mb-12">
          <h1 className="section-heading text-2xl md:text-4xl mb-4">Ready-Made Bouquets</h1>
          <p className="font-accent text-2xl text-astraea-rosegold">Choose from our curated collection</p>
        </div>

        <div className="scrapbook-card mb-8 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-[#FFFDFE]">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-5 h-5 text-astraea-pink mr-2" />
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`kawaii-btn min-h-11 px-4 py-2 text-sm font-bold ${categoryFilter === cat ? 'bg-astraea-pink text-white' : 'bg-white text-astraea-darkgray'}`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full md:w-auto">
            <span className="text-sm font-bold text-astraea-darkgray">Sort by:</span>
            <select value={sortOption} onChange={(e) => setSortOption(e.target.value)} className="kawaii-input w-full md:w-auto cursor-pointer">
              <option>Newest</option>
              <option>Price Low to High</option>
              <option>Price High to Low</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-96 bg-white animate-pulse rounded-xl border-2 border-dashed border-astraea-pink shadow-[4px_4px_0px_#F9A8C9]"></div>
            ))}
          </div>
        ) : filteredBouquets.length === 0 ? (
          <div className="scrapbook-card flex flex-col items-center justify-center py-20 bg-[#FFFDFE]">
            <Flower2 className="w-16 h-16 text-astraea-pink/40 mb-4" />
            <h3 className="font-heading text-xl md:text-2xl text-astraea-darkgray">No bouquets found</h3>
            <p className="text-astraea-darkgray/60 mt-2 text-center max-w-sm">
              We couldn't find any bouquets matching your current filters. Try selecting "All" categories.
            </p>
            <button onClick={() => setCategoryFilter('All')} className="kawaii-btn-primary mt-6 min-h-11 px-6 py-2 text-sm">
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {filteredBouquets.map((bouquet) => (
              <div key={bouquet.id} className={`group scrapbook-card overflow-hidden relative flex flex-col ${bouquet.id % 2 === 0 ? 'scrapbook-card-tilt-left' : 'scrapbook-card-tilt-right'} washi-strip bg-[#FFFDFE]`}>
                {bouquet.category && (
                  <div className="absolute top-4 left-4 z-10 kawaii-badge bg-[#FDDDE6] border-[#F9A8C9] text-[#C4658A]">
                    {bouquet.category}
                  </div>
                )}
                <div className="aspect-[4/5] bg-astraea-blush flex items-center justify-center overflow-hidden rounded-[16px]">
                  {bouquet.images?.[0] ? (
                    <img src={bouquet.images[0]} alt={bouquet.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 rounded-[16px]" />
                  ) : (
                    <Flower2 className="w-12 h-12 text-astraea-pink/30" />
                  )}
                </div>
                <div className="p-4 md:p-6 flex flex-col flex-grow">
                  <h3 className="font-heading font-bold text-base md:text-lg text-astraea-darkgray mb-2 line-clamp-1">{bouquet.name}</h3>
                  <p className="inline-flex w-fit px-3 py-1 rounded-xl bg-[#FFF3CC] border-2 border-[#F9C74F] font-accent text-xl text-[#8B6914] mb-6">₱{Number(bouquet.price).toFixed(2)}</p>
                  <div className="mt-auto flex flex-col space-y-3">
                    <Link to={`/shop/${bouquet.id}`} className="kawaii-btn-outline min-h-11 w-full py-3 text-center">View Details</Link>
                    <button onClick={() => handleAddToCart(bouquet)} className="kawaii-btn-primary min-h-11 w-full py-3 text-center">Add to Cart</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Shop;
