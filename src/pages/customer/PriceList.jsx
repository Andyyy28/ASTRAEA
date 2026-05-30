import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const PriceList = () => {
  const [flowers, setFlowers] = useState([]);
  const [flowerColors, setFlowerColors] = useState([]);
  const [fillers, setFillers] = useState([]);
  const [wrappers, setWrappers] = useState([]);
  const [wrapperColors, setWrapperColors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const [fRes, fcRes, filRes, wRes, wcRes] = await Promise.all([
        supabase.from('flowers').select('*'),
        supabase.from('flower_colors').select('*'),
        supabase.from('fillers').select('*'),
        supabase.from('wrappers').select('*'),
        supabase.from('wrapper_colors').select('*')
      ]);
      if (fRes.data) setFlowers(fRes.data);
      if (fcRes.data) setFlowerColors(fcRes.data);
      if (filRes.data) setFillers(filRes.data);
      if (wRes.data) setWrappers(wRes.data);
      if (wcRes.data) setWrapperColors(wcRes.data);
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) {
    return <div className="min-h-screen py-20 bg-astraea-cream flex justify-center"><div className="w-16 h-16 border-4 border-astraea-pink border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="animate-fade-in py-8 md:py-16 bg-astraea-cream min-h-screen text-astraea-darkgray">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 md:mb-16">
          <h1 className="section-heading text-2xl md:text-4xl mb-4">Price List</h1>
          <p className="font-accent text-2xl text-astraea-rosegold">All prices are per stem or per piece unless stated</p>
        </div>

        <div className="space-y-10 md:space-y-16">
          <section>
            <h2 className="section-heading text-xl md:text-3xl mb-6">✿ Flowers</h2>
            <div className="scrapbook-card washi-strip bg-[#FFFDFE] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-astraea-blush/40 border-b-2 border-dashed border-astraea-pink/30">
                      <th className="p-4 font-bold text-astraea-darkgray w-1/3">Flower Name</th>
                      <th className="p-4 font-bold text-astraea-darkgray w-1/4">Price (Per Stem)</th>
                      <th className="p-4 font-bold text-astraea-darkgray">Available Colors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flowers.map((f, idx) => (
                      <tr key={f.id} className={`border-b border-dashed border-astraea-pink/20 hover:bg-astraea-blush/20 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-astraea-cream'}`}>
                        <td className="p-4 font-bold font-body">{f.name}</td>
                        <td className="p-4"><span className="inline-flex px-3 py-1 rounded-xl bg-[#FFF3CC] border-2 border-[#F9C74F] font-accent text-2xl text-[#8B6914]">₱{f.price_per_stem}</span></td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-2">
                            {flowerColors.filter(c => c.flower_id === f.id).map(c => (
                              <div key={c.id} className="relative group">
                                <div className={`w-8 h-8 rounded-full border-2 ${!c.is_available ? 'border-[#C4658A] opacity-50' : 'border-white'} shadow-[2px_2px_0px_#F9A8C9]`} style={{ backgroundColor: c.hex_code }}>
                                  {!c.is_available && <div className="absolute inset-0 flex items-center justify-center"><div className="w-full h-0.5 bg-[#C4658A] transform rotate-45"></div></div>}
                                </div>
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 hidden group-hover:block z-10 w-max rounded-xl bg-[#FDDDE6] text-[#C4658A] text-xs px-2 py-1 font-accent border border-[#F9A8C9] shadow-[2px_2px_0px_#F9A8C9]">
                                  {c.color_name}
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section>
            <h2 className="section-heading text-xl md:text-3xl mb-6">♡ Fillers</h2>
            <div className="scrapbook-card washi-strip bg-[#FFFDFE] overflow-hidden overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-astraea-blush/40 border-b-2 border-dashed border-astraea-pink/30">
                    <th className="p-4 font-bold">Filler Name</th>
                    <th className="p-4 font-bold">Price</th>
                    <th className="p-4 font-bold text-right">Availability</th>
                  </tr>
                </thead>
                <tbody>
                  {fillers.map((f, idx) => (
                    <tr key={f.id} className={`border-b border-dashed border-astraea-pink/20 hover:bg-astraea-blush/20 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-astraea-cream'}`}>
                      <td className="p-4 font-medium font-body">{f.name}</td>
                      <td className="p-4"><span className="inline-flex px-3 py-1 rounded-xl bg-[#FFF3CC] border-2 border-[#F9C74F] font-accent text-2xl text-[#8B6914]">₱{f.price}</span></td>
                      <td className="p-4 text-right">
                        <span className={`kawaii-badge ${f.is_available ? 'bg-[#D5F0E8] border-[#A8DFC9] text-[#2D7A5F]' : 'bg-[#FDDDE6] border-[#F9A8C9] text-[#C4658A]'}`}>
                          {f.is_available ? '✓ Available' : '✕ Out of Stock'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="section-heading text-xl md:text-3xl mb-6">★ Wrappers</h2>
            <div className="scrapbook-card washi-strip bg-[#FFFDFE] overflow-hidden overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-astraea-blush/40 border-b-2 border-dashed border-astraea-pink/30">
                    <th className="p-4 font-bold w-1/3">Material</th>
                    <th className="p-4 font-bold w-1/4">Price</th>
                    <th className="p-4 font-bold">Available Colors</th>
                  </tr>
                </thead>
                <tbody>
                  {wrappers.map((w, idx) => (
                    <tr key={w.id} className={`border-b border-dashed border-astraea-pink/20 hover:bg-astraea-blush/20 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-astraea-cream'}`}>
                      <td className="p-4 font-medium font-body">{w.material}</td>
                      <td className="p-4"><span className="inline-flex px-3 py-1 rounded-xl bg-[#FFF3CC] border-2 border-[#F9C74F] font-accent text-2xl text-[#8B6914]">₱{w.price}</span></td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-2">
                          {wrapperColors.filter(c => c.wrapper_id === w.id).map(c => (
                            <div key={c.id} className="relative group">
                              <div className={`w-8 h-8 rounded-full border-2 ${!c.is_available ? 'border-[#C4658A] opacity-50' : 'border-white'} shadow-[2px_2px_0px_#F9A8C9]`} style={{ backgroundColor: c.hex_code }}>
                                {!c.is_available && <div className="absolute inset-0 flex items-center justify-center"><div className="w-full h-0.5 bg-[#C4658A] transform rotate-45"></div></div>}
                              </div>
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 hidden group-hover:block z-10 w-max rounded-xl bg-[#FDDDE6] text-[#C4658A] text-xs px-2 py-1 font-accent border border-[#F9A8C9] shadow-[2px_2px_0px_#F9A8C9]">
                                {c.color_name}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <section>
              <h2 className="section-heading text-2xl mb-4">✿ Add-Ons</h2>
              <div className="scrapbook-card washi-strip bg-[#FFFDFE] space-y-4">
                <div className="flex justify-between items-center border-b border-dashed border-astraea-pink/20 pb-2"><span className="font-medium">Premium Satin Ribbon</span><span className="inline-flex px-3 py-1 rounded-xl bg-[#FFF3CC] border-2 border-[#F9C74F] font-accent text-2xl text-[#8B6914]">₱20</span></div>
                <div className="flex justify-between items-center border-b border-dashed border-astraea-pink/20 pb-2"><span className="font-medium">Message Card</span><span className="inline-flex px-3 py-1 rounded-xl bg-[#FFF3CC] border-2 border-[#F9C74F] font-accent text-2xl text-[#8B6914]">₱15</span></div>
                <div className="flex justify-between items-center"><span className="font-medium">Gift Box</span><span className="font-medium text-astraea-darkgray/60 italic">Price Varies</span></div>
              </div>
            </section>

            <section>
              <h2 className="section-heading text-2xl mb-4">♡ Bouquet Size Base Prices</h2>
              <div className="scrapbook-card washi-strip bg-[#FFFDFE] overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-astraea-blush/40 border-b-2 border-dashed border-astraea-pink/30">
                      <th className="p-4 font-bold">Size</th>
                      <th className="p-4 font-bold">Base Price</th>
                      <th className="p-4 font-bold text-right">Approx. Stems</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-dashed border-astraea-pink/20 hover:bg-astraea-blush/20">
                      <td className="p-4 font-medium">Small</td>
                      <td className="p-4"><span className="inline-flex px-3 py-1 rounded-xl bg-[#FFF3CC] border-2 border-[#F9C74F] font-accent text-2xl text-[#8B6914]">₱150</span></td>
                      <td className="p-4 text-right text-astraea-darkgray/70">5–8 stems</td>
                    </tr>
                    <tr className="border-b border-dashed border-astraea-pink/20 hover:bg-astraea-blush/20">
                      <td className="p-4 font-medium">Medium</td>
                      <td className="p-4"><span className="inline-flex px-3 py-1 rounded-xl bg-[#FFF3CC] border-2 border-[#F9C74F] font-accent text-2xl text-[#8B6914]">₱250</span></td>
                      <td className="p-4 text-right text-astraea-darkgray/70">10–15 stems</td>
                    </tr>
                    <tr className="hover:bg-astraea-blush/20">
                      <td className="p-4 font-medium">Large</td>
                      <td className="p-4"><span className="inline-flex px-3 py-1 rounded-xl bg-[#FFF3CC] border-2 border-[#F9C74F] font-accent text-2xl text-[#8B6914]">₱400</span></td>
                      <td className="p-4 text-right text-astraea-darkgray/70">18–25 stems</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="scrapbook-card bg-[#FDDDE6] text-center mt-12">
            <p className="font-accent text-2xl text-[#C4658A] leading-relaxed">♡ Prices are subject to change. Final price depends on your customization. Contact us for bulk or event orders.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PriceList;
