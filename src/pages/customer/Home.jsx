import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Star, CheckCircle, Package, Truck, Heart } from 'lucide-react';

const Home = () => {
  const [featuredBouquets, setFeaturedBouquets] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHomeData = async () => {
      // In a real app with real RLS, this works. Here we fetch the dummy seed data
      const [bouquetsRes, reviewsRes] = await Promise.all([
        supabase.from('bouquets').select('*').eq('is_featured', true).limit(4),
        supabase.from('reviews').select('*').order('rating', { ascending: false }).limit(3)
      ]);
      
      if (bouquetsRes.data) setFeaturedBouquets(bouquetsRes.data);
      if (reviewsRes.data) setReviews(reviewsRes.data);
      setLoading(false);
    };

    fetchHomeData();
  }, []);

  return (
    <div className="animate-fade-in">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-br from-astraea-white to-astraea-blush min-h-[620px] md:min-h-[85vh] flex items-center py-8 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex flex-col md:flex-row items-center justify-between">
          <div className="w-full md:w-1/2 z-10 space-y-5 text-center md:text-left pt-4 md:pt-0">
            <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold text-astraea-pink leading-tight">
              Astraea Collection
            </h1>
            <p className="text-base md:text-2xl text-astraea-darkgray font-light max-w-lg mx-auto md:mx-0">
              Handcrafted fuzzy wire flowers that last forever.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2 justify-center md:justify-start">
              <Link to="/shop" className="min-h-11 px-8 py-3 bg-astraea-pink text-white rounded-full font-medium hover:bg-astraea-pink/90 transition-colors shadow-sm text-center">
                Shop Bouquets
              </Link>
              <Link to="/customize" className="min-h-11 px-8 py-3 bg-transparent border-2 border-astraea-pink text-astraea-pink rounded-full font-medium hover:bg-astraea-pink/5 transition-colors text-center">
                Customize Yours
              </Link>
            </div>
          </div>
          <div className="w-full md:w-1/2 mt-8 md:mt-0 relative flex justify-center">
            {/* Decorative floral placeholder */}
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 md:w-96 md:h-96 rounded-full bg-astraea-pink/10 flex items-center justify-center overflow-hidden border border-astraea-rosegold/20">
              <Heart className="w-32 h-32 text-astraea-pink/40" />
              <div className="absolute inset-0 bg-gradient-to-tr from-astraea-pink/20 to-transparent mix-blend-overlay"></div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. WHAT ARE FUZZY WIRE FLOWERS */}
      <section className="py-8 md:py-16 bg-astraea-blush/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="md:w-1/2 text-center md:text-left space-y-6">
              <h2 className="font-heading text-xl md:text-3xl font-bold text-astraea-darkgray">Flowers That Never Wilt</h2>
              <p className="text-sm md:text-base leading-relaxed text-astraea-darkgray/80">
                Fuzzy wire flowers are meticulously handcrafted from soft chenille stems, creating a beautiful, velvet-like texture. Unlike fresh flowers, they are completely hypoallergenic, require zero maintenance, and will stay beautiful forever. They make the perfect everlasting gift for anniversaries, graduations, or simply to brighten someone's day.
              </p>
            </div>
            <div className="md:w-1/2 w-full">
              <div className="aspect-[4/3] rounded-2xl bg-astraea-rosegold/10 flex items-center justify-center border border-astraea-rosegold/30 overflow-hidden relative">
                <span className="text-astraea-darkgray/40 font-medium">Image Placeholder</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. FEATURED BOUQUETS */}
      <section className="py-8 md:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 md:mb-16">
            <h2 className="font-heading text-xl md:text-3xl font-bold text-astraea-darkgray">Our Bestsellers</h2>
            <div className="w-24 h-1 bg-astraea-pink mx-auto mt-6 rounded-full"></div>
          </div>
          
          {loading ? (
            <div className="flex justify-center space-x-4">
              <div className="w-64 h-80 bg-astraea-blush animate-pulse rounded-xl"></div>
              <div className="w-64 h-80 bg-astraea-blush animate-pulse rounded-xl hidden md:block"></div>
              <div className="w-64 h-80 bg-astraea-blush animate-pulse rounded-xl hidden lg:block"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {featuredBouquets.map((bouquet) => (
                <div key={bouquet.id} className="group bg-white rounded-xl border border-astraea-pink/30 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                  <div className="aspect-[4/5] bg-astraea-blush flex items-center justify-center relative">
                    <span className="text-astraea-pink/50">Photo</span>
                  </div>
                  <div className="p-4 md:p-6 space-y-4">
                    <h3 className="font-heading font-bold text-base md:text-lg text-astraea-darkgray line-clamp-1">{bouquet.name}</h3>
                    <p className="font-bold text-astraea-pink">₱{bouquet.price}</p>
                    <Link to={`/shop/${bouquet.id}`} className="min-h-11 flex items-center justify-center w-full py-2 text-center border border-astraea-pink text-astraea-pink rounded-full hover:bg-astraea-pink hover:text-white transition-colors">
                      View
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 4. HOW IT WORKS */}
      <section className="py-8 md:py-16 bg-astraea-blush">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 md:mb-16">
            <h2 className="font-heading text-xl md:text-3xl font-bold text-astraea-darkgray">How It Works</h2>
          </div>
          <div className="flex flex-col md:flex-row gap-8 md:gap-12 text-center">
            <div className="space-y-6 flex flex-col items-center">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-md text-astraea-pink">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h3 className="font-heading text-2xl font-bold">1. Browse or Customize</h3>
              <p className="text-astraea-darkgray/80">Choose from our ready-made bestsellers or build your own dream bouquet from scratch.</p>
            </div>
            <div className="space-y-6 flex flex-col items-center">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-md text-astraea-pink">
                <Package className="w-10 h-10" />
              </div>
              <h3 className="font-heading text-2xl font-bold">2. Place Your Order</h3>
              <p className="text-astraea-darkgray/80">Select your preferred delivery method—convenient pickup or doorstep delivery.</p>
            </div>
            <div className="space-y-6 flex flex-col items-center">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-md text-astraea-pink">
                <Truck className="w-10 h-10" />
              </div>
              <h3 className="font-heading text-2xl font-bold">3. Receive Forever Flowers</h3>
              <p className="text-astraea-darkgray/80">We craft your order with love and deliver beautiful flowers that will last a lifetime.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. TESTIMONIALS */}
      <section className="py-8 md:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 md:mb-16">
            <h2 className="font-heading text-xl md:text-3xl font-bold text-astraea-darkgray">What Our Customers Say</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {reviews.map((review) => (
              <div key={review.id} className="bg-astraea-blush/50 p-4 md:p-6 rounded-2xl border border-astraea-rosegold/20">
                <div className="flex text-astraea-rosegold mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-5 h-5 ${i < review.rating ? 'fill-current' : 'opacity-30'}`} />
                  ))}
                </div>
                <p className="font-heading italic text-lg text-astraea-darkgray/90 mb-6">
                  "{review.message}"
                </p>
                <p className="font-bold text-sm tracking-wide">— {review.customer_name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. CALL TO ACTION BANNER */}
      <section className="bg-astraea-pink py-8 md:py-16 text-center">
        <div className="max-w-4xl mx-auto px-4 space-y-8">
          <h2 className="font-heading text-xl md:text-3xl font-bold text-white">Ready to build your dream bouquet?</h2>
          <Link to="/customize" className="min-h-11 inline-flex items-center px-10 py-4 bg-white text-astraea-pink rounded-full font-bold text-base md:text-lg hover:bg-astraea-blush transition-colors shadow-lg">
            Start Customizing
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
