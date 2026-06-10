import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatPrice } from '../../lib/formatPrice';
import { Star, CheckCircle, Package, Truck, Heart } from 'lucide-react';
import violetBouquetFeature from '../../assets/violet-bouquet-feature.jpeg';
import Skeleton from '../../components/Skeleton';

const PersonIcon = () => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className="h-4 w-4 text-astraea-darkgray/80"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21a8 8 0 0 0-16 0" />
    <circle cx="12" cy="8" r="4" />
  </svg>
);

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
        supabase
          .from('reviews')
          .select('id, name, message, rating, admin_reply, created_at')
          .eq('is_displayed', true)
          .order('created_at', { ascending: false })
          .limit(3)
      ]);

      if (bouquetsRes.data) setFeaturedBouquets(bouquetsRes.data);
      if (reviewsRes.data) setReviews(reviewsRes.data);
      setLoading(false);
    };

    fetchHomeData();
  }, []);

  return (
    <div className="animate-fade-in">
      <section className="home-hero-mobile relative overflow-hidden bg-[#FFE7EF]">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 border-t-2 border-dashed border-[#F58AB6]/75"></div>
        <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-[1680px] items-stretch lg:grid-cols-[1fr_minmax(0,1.35fr)]">
          <div className="relative flex min-h-[420px] items-center px-5 py-12 sm:px-8 md:px-12 lg:px-14 xl:px-20">
            <div className="home-hero-mobile-wash absolute inset-0 bg-[radial-gradient(circle_at_8%_22%,rgba(255,255,255,0.98)_0,rgba(255,255,255,0.86)_24%,rgba(255,255,255,0.48)_44%,rgba(255,255,255,0)_68%)]"></div>
            <div className="home-hero-mobile-edge absolute inset-y-0 right-0 w-32 bg-gradient-to-r from-[#FFE7EF] via-[#FFE7EF]/85 to-transparent sm:w-44 lg:w-52"></div>

            <div className="relative z-10 w-full max-w-[720px] space-y-6 text-left">
              <div className="inline-flex items-center gap-3 rounded-full border-2 border-dashed border-[#DE3163]/75 bg-white/70 px-6 py-3 shadow-[0_8px_20px_rgba(232,145,184,0.16)]">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[#DE3163] text-base text-white">
                  <Heart className="h-4 w-4 fill-current" />
                </span>
                <span className="font-accent text-[clamp(1.4rem,2vw,2.1rem)] text-[#DE3163]">cute flower shop</span>
              </div>

              <h1 className="max-w-[11ch] font-heading text-[clamp(3.5rem,6vw,7.75rem)] font-black leading-[0.9] tracking-[-0.03em] text-[#DE3163]">
                Astraea
                <span className="block">Collection</span>
              </h1>

              <div className="flex w-28 items-center gap-2">
                <span className="h-1.5 flex-1 rounded-full bg-[#DE3163]"></span>
                <span className="h-2.5 w-2.5 rounded-full bg-[#DE3163]"></span>
                <span className="h-2.5 w-2.5 rounded-full bg-[#DE3163]"></span>
                <span className="h-2.5 w-2.5 rounded-full bg-[#DE3163]"></span>
              </div>

              <p className="max-w-[14ch] font-accent text-[clamp(2.2rem,3vw,4.2rem)] leading-[1.05] text-[#DE3163]">
                Handcrafted fuzzy wire flowers that last forever.
              </p>

              <div className="flex flex-col gap-4 pt-2 sm:flex-row">
                <Link to="/shop" className="kawaii-btn-primary min-h-14 border-[#E0115F] bg-[#E0115F] px-10 text-lg text-white hover:bg-[#C80F54]">
                  Shop Bouquets
                </Link>
                <Link to="/customize" className="kawaii-btn-outline min-h-14 border-dashed border-[#E0115F] px-10 text-lg text-[#E0115F] hover:bg-[#E0115F] hover:text-white">
                  Customize Yours
                </Link>
              </div>
            </div>
          </div>

          <div className="home-hero-desktop-photo relative min-h-[420px] overflow-hidden lg:-ml-24 lg:min-h-full">
            <img
              src="/home-hero.jpeg"
              alt="Colorful handmade fuzzy wire bouquets"
              className="h-full w-full object-cover object-center"
            />
            <div className="home-hero-mobile-photo-wash absolute inset-0 bg-[linear-gradient(90deg,rgba(255,231,239,0.98)_0%,rgba(255,231,239,0.92)_14%,rgba(255,231,239,0.55)_28%,rgba(255,231,239,0.18)_46%,rgba(255,231,239,0.03)_60%,rgba(255,231,239,0)_70%),linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.02)_100%)]"></div>
            <div className="home-hero-mobile-bottom-fade absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#FFE7EF] via-[#FFE7EF]/65 to-transparent"></div>
          </div>
        </div>
      </section>
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_18%_22%,#FFFFFFD9_0,#FFFFFF00_24%),radial-gradient(circle_at_84%_18%,#FFFFFFB8_0,#FFFFFF00_22%),linear-gradient(135deg,#FFE7EF_0%,#FFF5F8_48%,#FAD8E9_100%)] py-12 md:py-20">
        <div className="pointer-events-none absolute inset-0">
          <span className="absolute left-[3%] top-[18%] text-4xl text-astraea-pink/35 animate-float">♡</span>
          <span className="absolute left-[8%] bottom-[16%] text-4xl text-astraea-pink/40 animate-float" style={{ animationDelay: '0.8s' }}>✿</span>
          <span className="absolute right-[7%] top-[20%] text-3xl text-astraea-pink/35 animate-float" style={{ animationDelay: '1.1s' }}>♡</span>
          <span className="absolute right-[4%] bottom-[16%] text-4xl text-white animate-float" style={{ animationDelay: '1.5s' }}>✦</span>
          <span className="absolute left-[42%] top-[10%] text-3xl text-white animate-float" style={{ animationDelay: '1.8s' }}>✦</span>
          <span className="absolute right-[14%] bottom-[34%] text-3xl text-astraea-pink/30 animate-float" style={{ animationDelay: '2s' }}>❀</span>
        </div>

        <div className="relative z-10 mx-auto grid max-w-[1180px] items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
          <div className="relative space-y-8 text-center lg:text-left">
            <div>
              <h2 className="section-heading text-3xl md:text-4xl">
                ✿ Flowers That Never Wilt
              </h2>
              <div className="mt-6 space-y-5 text-sm leading-7 text-astraea-darkgray/85 md:text-base">
                <p>
                  Fuzzy wire flowers are meticulously handcrafted from soft chenille stems, creating a beautiful, velvet-like texture. Unlike fresh flowers, they are completely hypoallergenic, require zero maintenance, and will stay beautiful forever.
                </p>
                <p>
                  They make the perfect everlasting gift for anniversaries, graduations, or simply to brighten someone's day.
                </p>
              </div>
            </div>

            <div className="mx-auto w-fit rotate-[-3deg] rounded-[18px] border-2 border-dashed border-astraea-pink/45 bg-white/75 px-8 py-4 font-accent text-3xl font-bold leading-tight text-astraea-rosegold shadow-[5px_5px_0px_rgba(249,168,201,0.35)] lg:mx-0">
              ♡ Made with love,
              <span className="block">just for you</span>
            </div>

            <div className="pointer-events-none absolute right-[-5rem] top-[42%] hidden h-36 w-28 rounded-full border-r-2 border-dashed border-astraea-pink/70 lg:block">
              <span className="absolute bottom-2 right-[-5px] h-3 w-3 rotate-45 border-b-2 border-r-2 border-astraea-pink/70"></span>
              <span className="absolute right-[-1rem] top-2 font-accent text-2xl text-astraea-rosegold">♡</span>
            </div>
          </div>

          <div className="animate-float-up-down relative mx-auto w-full max-w-[560px]">
            <div className="absolute left-[30%] top-[-16px] z-20 h-12 w-44 rotate-[1deg] rounded-sm bg-[#FFE1A8]/90 shadow-[0_4px_16px_rgba(232,145,184,0.18)] before:absolute before:inset-0 before:bg-[radial-gradient(#fff_1.2px,transparent_1.2px)] before:bg-[length:16px_12px] before:opacity-70"></div>
            <div className="absolute -right-3 bottom-0 h-[88%] w-[82%] rotate-[4deg] rounded-[22px] bg-[#F8AEBE]/65 shadow-[8px_14px_22px_rgba(232,145,184,0.25)]"></div>
            <div className="relative rotate-[1deg] rounded-[24px] bg-white p-4 pb-16 shadow-[0_24px_45px_rgba(96,53,70,0.18)] ring-2 ring-astraea-pink/15">
              <div className="aspect-[4/3.7] overflow-hidden rounded-[14px] bg-astraea-blush">
                <img src={violetBouquetFeature} alt="Violet fuzzy wire bouquet" className="h-full w-full object-cover object-center" />
              </div>
              <p className="absolute bottom-5 left-0 right-0 text-center font-accent text-3xl font-bold text-astraea-rosegold">
                ♡
              </p>
            </div>
            <div className="absolute -bottom-4 right-2 z-20 grid h-20 w-20 place-items-center rounded-full border-4 border-white bg-[#F9A8C9] text-4xl text-white shadow-[3px_5px_0px_rgba(232,145,184,0.45)]">
              ✿
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
            <div className="flex flex-wrap justify-center gap-4 md:gap-6 mx-auto max-w-6xl">
              {[1, 2, 3].map(i => (
                <div key={i} className={`scrapbook-card w-full max-w-[20rem] flex-1 basis-[18rem] space-y-4 p-4 ${i === 3 ? 'hidden lg:block' : i === 2 ? 'hidden md:block' : ''}`}>
                  <Skeleton className="w-full aspect-[4/5] rounded-[16px]" />
                  <Skeleton className="w-2/3 h-5" />
                  <Skeleton className="w-1/3 h-7 rounded-xl" />
                  <Skeleton className="w-full h-11 rounded-full" />
                </div>
              ))}
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
            <div className="flex flex-wrap justify-center gap-4 md:gap-6 mx-auto max-w-6xl fade-in-content">
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
                    <p className="inline-flex items-center px-3 py-1 rounded-xl bg-[#FFF3CC] border-2 border-[#F9C74F] font-accent text-xl text-[#8B6914]">{formatPrice(bouquet.price)}</p>
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
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="scrapbook-card bg-[#FFFDFE] p-4 md:p-6 space-y-4">
                  <div className="flex gap-1 mb-4">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Skeleton key={star} className="w-5 h-5 rounded-full" />
                    ))}
                  </div>
                  <Skeleton className="w-full h-16" />
                  <Skeleton className="w-24 h-4 mt-6" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 fade-in-content">
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
                  {review.admin_reply && (
                    <div className="mb-5 rounded-2xl border-2 border-dashed border-astraea-pink/30 bg-astraea-blush/30 p-4 text-sm text-astraea-darkgray/80">
                      <p className="font-bold text-[#C4658A] mb-1">Astraea replied:</p>
                      <p>{review.admin_reply}</p>
                    </div>
                  )}
                  <p className="font-bold text-sm tracking-wide flex items-center gap-2">
                    <PersonIcon />
                    <span>{review.name}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
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
