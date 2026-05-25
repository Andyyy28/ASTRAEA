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
    return (
      <div className="min-h-screen py-20 bg-astraea-blush/30 flex justify-center">
        <div className="w-16 h-16 border-4 border-astraea-pink border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in py-12 bg-astraea-blush/20 min-h-screen text-astraea-darkgray">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Page Header */}
        <div className="text-center mb-16">
          <h1 className="font-heading text-4xl md:text-5xl font-bold mb-4">Price List</h1>
          <p className="text-lg text-astraea-darkgray/70">All prices are per stem or per piece unless stated</p>
          <div className="w-24 h-1 bg-astraea-pink mx-auto mt-6 rounded-full"></div>
        </div>

        <div className="space-y-16">
          
          {/* SECTION 1 - FLOWERS */}
          <section>
            <h2 className="font-heading text-3xl font-bold mb-6 text-astraea-pink border-b border-astraea-rosegold/30 pb-2">Flowers</h2>
            <div className="bg-white rounded-xl shadow-sm border border-astraea-rosegold/20 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-astraea-blush border-b border-astraea-rosegold/30">
                      <th className="p-4 font-bold text-astraea-darkgray w-1/3">Flower Name</th>
                      <th className="p-4 font-bold text-astraea-darkgray w-1/4">Price (Per Stem)</th>
                      <th className="p-4 font-bold text-astraea-darkgray">Available Colors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flowers.map(f => (
                      <tr key={f.id} className="border-b border-astraea-rosegold/10 hover:bg-astraea-blush/20 transition-colors">
                        <td className="p-4 font-bold">{f.name}</td>
                        <td className="p-4 text-astraea-pink font-bold">₱{f.price_per_stem}</td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-2">
                            {flowerColors.filter(c => c.flower_id === f.id).map(c => (
                              <div key={c.id} className="relative group">
                                <div 
                                  className={`w-6 h-6 rounded-full border border-gray-300 shadow-sm ${!c.is_available ? 'opacity-40' : ''}`}
                                  style={{ backgroundColor: c.hex_code }}
                                >
                                  {!c.is_available && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <div className="w-full h-0.5 bg-red-500 transform rotate-45"></div>
                                    </div>
                                  )}
                                </div>
                                {/* Tooltip */}
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 hidden group-hover:block z-10 w-max bg-astraea-darkgray text-white text-xs px-2 py-1 rounded">
                                  {c.color_name} {!c.is_available && '(Out of Stock)'}
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

          {/* SECTION 2 - FILLERS */}
          <section>
            <h2 className="font-heading text-3xl font-bold mb-6 text-astraea-pink border-b border-astraea-rosegold/30 pb-2">Fillers</h2>
            <div className="bg-white rounded-xl shadow-sm border border-astraea-rosegold/20 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-astraea-blush border-b border-astraea-rosegold/30">
                    <th className="p-4 font-bold">Filler Name</th>
                    <th className="p-4 font-bold">Price</th>
                    <th className="p-4 font-bold text-right">Availability</th>
                  </tr>
                </thead>
                <tbody>
                  {fillers.map(f => (
                    <tr key={f.id} className="border-b border-astraea-rosegold/10 hover:bg-astraea-blush/20 transition-colors">
                      <td className="p-4 font-medium">{f.name}</td>
                      <td className="p-4 font-bold">₱{f.price}</td>
                      <td className="p-4 text-right">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${f.is_available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {f.is_available ? 'Available' : 'Out of Stock'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* SECTION 3 - WRAPPERS */}
          <section>
            <h2 className="font-heading text-3xl font-bold mb-6 text-astraea-pink border-b border-astraea-rosegold/30 pb-2">Wrappers</h2>
            <div className="bg-white rounded-xl shadow-sm border border-astraea-rosegold/20 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-astraea-blush border-b border-astraea-rosegold/30">
                    <th className="p-4 font-bold w-1/3">Material</th>
                    <th className="p-4 font-bold w-1/4">Price</th>
                    <th className="p-4 font-bold">Available Colors</th>
                  </tr>
                </thead>
                <tbody>
                  {wrappers.map(w => (
                    <tr key={w.id} className="border-b border-astraea-rosegold/10 hover:bg-astraea-blush/20 transition-colors">
                      <td className="p-4 font-medium">{w.material}</td>
                      <td className="p-4 font-bold">₱{w.price}</td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-2">
                          {wrapperColors.filter(c => c.wrapper_id === w.id).map(c => (
                            <div key={c.id} className="relative group">
                              <div 
                                className={`w-6 h-6 rounded-full border border-gray-300 shadow-sm ${!c.is_available ? 'opacity-40' : ''}`}
                                style={{ backgroundColor: c.hex_code }}
                              >
                                {!c.is_available && (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-full h-0.5 bg-red-500 transform rotate-45"></div>
                                  </div>
                                )}
                              </div>
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 hidden group-hover:block z-10 w-max bg-astraea-darkgray text-white text-xs px-2 py-1 rounded">
                                {c.color_name} {!c.is_available && '(Out of Stock)'}
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
            {/* SECTION 4 - ADD-ONS */}
            <section>
              <h2 className="font-heading text-2xl font-bold mb-4 text-astraea-pink border-b border-astraea-rosegold/30 pb-2">Add-Ons</h2>
              <div className="bg-white rounded-xl shadow-sm border border-astraea-rosegold/20 p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-astraea-rosegold/10 pb-2">
                  <span className="font-medium">Premium Satin Ribbon</span>
                  <span className="font-bold">₱20</span>
                </div>
                <div className="flex justify-between items-center border-b border-astraea-rosegold/10 pb-2">
                  <span className="font-medium">Message Card</span>
                  <span className="font-bold">₱15</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">Gift Box</span>
                  <span className="font-bold text-astraea-darkgray/60 italic">Price Varies</span>
                </div>
              </div>
            </section>

            {/* SECTION 5 - BASE PRICES */}
            <section>
              <h2 className="font-heading text-2xl font-bold mb-4 text-astraea-pink border-b border-astraea-rosegold/30 pb-2">Bouquet Size Base Prices</h2>
              <div className="bg-white rounded-xl shadow-sm border border-astraea-rosegold/20 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-astraea-blush border-b border-astraea-rosegold/30">
                      <th className="p-4 font-bold">Size</th>
                      <th className="p-4 font-bold">Base Price</th>
                      <th className="p-4 font-bold text-right">Approx. Stems</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-astraea-rosegold/10 hover:bg-astraea-blush/20">
                      <td className="p-4 font-medium">Small</td>
                      <td className="p-4 font-bold">₱150</td>
                      <td className="p-4 text-right text-astraea-darkgray/70">5–8 stems</td>
                    </tr>
                    <tr className="border-b border-astraea-rosegold/10 hover:bg-astraea-blush/20">
                      <td className="p-4 font-medium">Medium</td>
                      <td className="p-4 font-bold">₱250</td>
                      <td className="p-4 text-right text-astraea-darkgray/70">10–15 stems</td>
                    </tr>
                    <tr className="hover:bg-astraea-blush/20">
                      <td className="p-4 font-medium">Large</td>
                      <td className="p-4 font-bold">₱400</td>
                      <td className="p-4 text-right text-astraea-darkgray/70">18–25 stems</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* NOTE BOX */}
          <div className="bg-astraea-pink/10 border border-astraea-pink/30 rounded-2xl p-8 text-center mt-12">
            <p className="text-lg text-astraea-pink font-medium leading-relaxed">
              Prices are subject to change. Final price depends on your customization. <br className="hidden md:block" />
              Contact us for bulk or event orders.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PriceList;
