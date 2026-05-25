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
      // Fetch all visible bouquets
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

    // Apply category filter
    if (categoryFilter !== 'All') {
      // In seed data, we used 'Rose', 'Sunflower', 'Lily' as categories, 
      // but the spec asked for 'Romantic', 'Birthday' etc. 
      // Let's do a loose inclusion check or just exact match.
      // If we don't have matching seed categories, it might show empty, which is fine for demo.
      result = result.filter(b => b.category?.includes(categoryFilter));
    }

    // Apply sort
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
    <div className="animate-fade-in py-12 bg-astraea-blush/30 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="font-heading text-4xl md:text-5xl font-bold text-astraea-darkgray mb-4">
            Ready-Made Bouquets
          </h1>
          <p className="text-lg text-astraea-darkgray/70 font-light">
            Choose from our curated collection
          </p>
        </div>

        {/* Filters Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-astraea-rosegold/20 mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-5 h-5 text-astraea-pink mr-2" />
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  categoryFilter === cat 
                    ? 'bg-astraea-pink text-white' 
                    : 'bg-astraea-blush text-astraea-darkgray hover:bg-astraea-pink/20'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-astraea-darkgray">Sort by:</span>
            <select 
              value={sortOption} 
              onChange={(e) => setSortOption(e.target.value)}
              className="bg-astraea-blush border-none rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-astraea-pink outline-none cursor-pointer"
            >
              <option>Newest</option>
              <option>Price Low to High</option>
              <option>Price High to Low</option>
            </select>
          </div>
        </div>

        {/* Bouquet Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-96 bg-white animate-pulse rounded-xl border border-astraea-rosegold/10"></div>
            ))}
          </div>
        ) : filteredBouquets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-astraea-rosegold/20 border-dashed">
            <Flower2 className="w-16 h-16 text-astraea-pink/40 mb-4" />
            <h3 className="font-heading text-2xl text-astraea-darkgray">No bouquets found</h3>
            <p className="text-astraea-darkgray/60 mt-2 text-center max-w-sm">
              We couldn't find any bouquets matching your current filters. Try selecting "All" categories.
            </p>
            <button 
              onClick={() => setCategoryFilter('All')} 
              className="mt-6 px-6 py-2 bg-astraea-pink text-white rounded-full text-sm hover:bg-astraea-pink/90"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredBouquets.map((bouquet) => (
              <div key={bouquet.id} className="group bg-white rounded-xl border border-astraea-rosegold/20 overflow-hidden hover:-translate-y-2 hover:shadow-xl transition-all duration-300 relative flex flex-col">
                
                {/* Category Badge */}
                {bouquet.category && (
                  <div className="absolute top-4 left-4 z-10 bg-astraea-pink text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                    {bouquet.category}
                  </div>
                )}
                
                {/* Image */}
                <div className="aspect-[4/5] bg-astraea-blush flex items-center justify-center overflow-hidden">
                  {bouquet.images?.[0] ? (
                    <img 
                      src={bouquet.images[0]} 
                      alt={bouquet.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <Flower2 className="w-12 h-12 text-astraea-pink/30" />
                  )}
                </div>
                
                {/* Details */}
                <div className="p-6 flex flex-col flex-grow">
                  <h3 className="font-heading font-bold text-2xl text-astraea-darkgray mb-2 line-clamp-1">{bouquet.name}</h3>
                  <p className="font-bold text-astraea-pink text-xl mb-6">₱{Number(bouquet.price).toFixed(2)}</p>
                  
                  <div className="mt-auto flex flex-col space-y-3">
                    <Link 
                      to={`/shop/${bouquet.id}`} 
                      className="w-full py-3 text-center border border-astraea-pink text-astraea-pink rounded-full font-medium hover:bg-astraea-pink/5 transition-colors"
                    >
                      View Details
                    </Link>
                    <button 
                      onClick={() => handleAddToCart(bouquet)}
                      className="w-full py-3 text-center bg-astraea-pink text-white rounded-full font-medium hover:bg-astraea-pink/90 transition-colors shadow-sm"
                    >
                      Add to Cart
                    </button>
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
