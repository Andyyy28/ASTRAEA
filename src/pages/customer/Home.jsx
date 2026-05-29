import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Star, CheckCircle, Package, Truck, Heart } from 'lucide-react';
import astraeaLogo from '../../assets/astraea-logo.jpg';

const Home = () => {
  const [featuredBouquets, setFeaturedBouquets] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHomeData = async () => {
      const [bouquetsRes, reviewsRes] = await Promise.all([
        supabase
          .from('bouquets')
          .select('*')
          .eq('is_visible', true)
          .eq('is_featured', true)
          .order('created_at', { ascending: false })
          .limit(4),
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
      <section className="relative overflow-hidden bg-gradient-to-br from-[#FFF5F7] via-[#FDDDE6] to-[#E8D5F5] min-h-[620px] md:min-h-[85vh] flex items-center py-8 md:py-16">
        <div className="pointer-events-none absolute inset-0">
          <span className="absolute left-6 top-8 text-4xl text-astraea-pink/30 animate-float">♡</span>
          <span className="absolute right-10 top-12 text-3xl text-astraea-lavender/50 animate-float" style={{ animationDelay: '0.8s' }}>✦</span>
          <span className="absolute left-[18%] bottom-20 text-3xl text-astraea-mint/50 animate-float" style={{ animationDelay: '1.2s' }}>✿</span>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex flex-col md:flex-row items-center justify-between">
          <div className="w-full md:w-1/2 z-10 space-y-5 text-center md:text-left pt-4 md:pt-0">
            <div className="inline-flex items-center rounded-full bg-white/80 px-4 py-2 border-2 border-dashed border-astraea-pink shadow-[3px_3px_0px_#F9A8C9] mx-auto md:mx-0">
              <span className="font-accent text-2xl text-astraea-rosegold">♡ cute flower shop</span>
            </div>
            <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-extrabold text-astraea-darkgray leading-tight">
              Astraea Collection
            </h1>
            <p className="font-accent text-2xl md:text-4xl text-astraea-rosegold max-w-lg mx-auto md:mx-0">
              Handcrafted fuzzy wire flowers that last forever.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2 justify-center md:justify-start">
              <Link to="/shop" className="kawaii-btn-primary min-h-11 px-8 py-3 text-center">
                Shop Bouquets
              </Link>
              <Link to="/customize" className="kawaii-btn-outline min-h-11 px-8 py-3 text-center">
                Customize Yours
              </Link>
            </div>
          </div>
          <div className="w-full md:w-1/2 mt-8 md:mt-0 relative flex justify-center">
            <div className="absolute -top-3 left-8 h-8 w-32 rotate-[-8deg] bg-[#FFF3CC] border-2 border-dashed border-[#F9C74F] shadow-[2px_2px_0px_#F9C74F] rounded-md z-10"></div>
            <div className="relative w-[19rem] h-[19rem] sm:w-[23rem] sm:h-[23rem] md:w-[30rem] md:h-[30rem] rounded-[28px] bg-white/80 flex items-center justify-center overflow-hidden border-2 border-dashed border-astraea-pink shadow-[8px_8px_0px_#F9A8C9] rotate-[-1deg]">
              <img src={astraeaLogo} alt="Astraea Collection bouquet logo" className="w-full h-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-astraea-darkgray/35 to-transparent"></div>
              <div className="absolute inset-0 ring-8 ring-white/35 ring-inset"></div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-8 md:py-16 bg-astraea-blush/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="md:w-1/2 text-center md:text-left space-y-6">
              <h2 className="section-heading text-xl md:text-3xl">✿ Flowers That Never Wilt</h2>
              <p className="text-sm md:text-base leading-relaxed text-astraea-darkgray/80 font-body">
                Fuzzy wire flowers are meticulously handcrafted from soft chenille stems, creating a beautiful, velvet-like texture. Unlike fresh flowers, they are completely hypoallergenic, require zero maintenance, and will stay beautiful forever. They make the perfect everlasting gift for anniversaries, graduations, or simply to brighten someone's day.
              </p>
            </div>
            <div className="md:w-1/2 w-full">
              <div className="scrapbook-card aspect-[4/3] bg-[#FFFDFE] flex items-center justify-center border-dashed rotate-[1deg]">
                <span className="font-accent text-3xl text-astraea-rosegold">♡ handmade & hypoallergenic</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-8 md:py-16 bg-astraea-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 md:mb-16">
            <h2 className="section-heading text-xl md:text-3xl">★ Our Bestsellers</h2>
          </div>

          {loading ? (
            <div className="flex justify-center space-x-4">
              <div className="w-64 h-80 bg-astraea-blush animate-pulse rounded-xl"></div>
              <div className="w-64 h-80 bg-astraea-blush animate-pulse rounded-xl hidden md:block"></div>
              <div className="w-64 h-80 bg-astraea-blush animate-pulse rounded-xl hidden lg:block"></div>
            </div>
          ) : featuredBouquets.length === 0 ? (
            <div className="scrapbook-card bg-[#FFFDFE] text-center py-16">
              <Heart className="w-14 h-14 mx-auto text-astraea-pink/40 mb-4" />
              <h3 className="font-heading text-xl md:text-2xl text-astraea-darkgray">No best sellers selected yet</h3>
              <p className="text-astraea-darkgray/70 mt-2 max-w-md mx-auto">
                Use the heart button in admin to mark bouquets as best sellers and they will appear here.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-4 md:gap-6 mx-auto max-w-6xl">
              {featuredBouquets.map((bouquet) => {
                const image = bouquet.images?.[0];

                return (
                <div key={bouquet.id} className={`group scrapbook-card overflow-hidden ${bouquet.id % 2 === 0 ? 'scrapbook-card-tilt-left' : 'scrapbook-card-tilt-right'} washi-strip w-full max-w-[20rem] flex-1 basis-[18rem]`}>
                  <div className="aspect-[4/5] bg-astraea-blush flex items-center justify-center relative rounded-[16px] overflow-hidden">
                    {image ? (
                      <img src={image} alt={bouquet.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Heart className="w-12 h-12 text-astraea-pink/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-astraea-darkgray/20 via-transparent to-white/10"></div>
                  </div>
                  <div className="p-4 md:p-6 space-y-4">
                    <h3 className="font-heading font-bold text-base md:text-lg text-astraea-darkgray line-clamp-1">{bouquet.name}</h3>
                    <p className="inline-flex items-center px-3 py-1 rounded-xl bg-[#FFF3CC] border-2 border-[#F9C74F] font-accent text-xl text-[#8B6914]">₱{bouquet.price}</p>
                    <Link to={`/shop/${bouquet.id}`} className="kawaii-btn-outline min-h-11 flex items-center justify-center w-full py-2 text-center">
                      View
                    </Link>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="py-8 md:py-16 bg-astraea-blush/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 md:mb-16">
            <h2 className="section-heading text-xl md:text-3xl">♡ How It Works</h2>
          </div>
          <div className="flex flex-col md:flex-row gap-8 md:gap-12 text-center">
            <div className="space-y-6 flex flex-col items-center">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-[4px_4px_0px_#F9A8C9] border-2 border-dashed border-astraea-pink text-astraea-pink">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h3 className="font-heading text-2xl font-bold">1. Browse or Customize</h3>
              <p className="text-astraea-darkgray/80">Choose from our ready-made bestsellers or build your own dream bouquet from scratch.</p>
            </div>
            <div className="space-y-6 flex flex-col items-center">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-[4px_4px_0px_#F9A8C9] border-2 border-dashed border-astraea-pink text-astraea-pink">
                <Package className="w-10 h-10" />
              </div>
              <h3 className="font-heading text-2xl font-bold">2. Place Your Order</h3>
              <p className="text-astraea-darkgray/80">Select your preferred delivery method, convenient pickup or doorstep delivery.</p>
            </div>
            <div className="space-y-6 flex flex-col items-center">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-[4px_4px_0px_#F9A8C9] border-2 border-dashed border-astraea-pink text-astraea-pink">
                <Truck className="w-10 h-10" />
              </div>
              <h3 className="font-heading text-2xl font-bold">3. Receive Forever Flowers</h3>
              <p className="text-astraea-darkgray/80">We craft your order with love and deliver beautiful flowers that will last a lifetime.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-8 md:py-16 bg-astraea-lavender/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 md:mb-16">
            <h2 className="section-heading text-xl md:text-3xl">✦ What Our Customers Say</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {reviews.map((review) => (
              <div key={review.id} className="scrapbook-card bg-[#FFFDFE] p-4 md:p-6">
                <div className="flex text-astraea-rosegold mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-5 h-5 ${i < review.rating ? 'fill-current' : 'opacity-30'}`} />
                  ))}
                </div>
                <p className="font-accent italic text-xl text-astraea-darkgray/90 mb-6">
                  "{review.message}"
                </p>
                <p className="font-bold text-sm tracking-wide">♡ {review.customer_name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-astraea-pink py-8 md:py-16 text-center relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <span className="absolute left-10 top-6 text-white text-4xl animate-float">✿</span>
          <span className="absolute right-12 bottom-8 text-white text-3xl animate-float" style={{ animationDelay: '1s' }}>♡</span>
        </div>
        <div className="max-w-4xl mx-auto px-4 space-y-8">
          <h2 className="font-heading text-xl md:text-3xl font-extrabold text-white">Ready to build your dream bouquet?</h2>
          <Link to="/customize" className="kawaii-btn-outline bg-white text-astraea-darkgray min-h-11 inline-flex items-center px-10 py-4">
            Start Customizing
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
