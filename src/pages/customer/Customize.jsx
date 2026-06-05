import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatPrice } from '../../lib/formatPrice';
import { useCart } from '../../context/CartContext';
import { useNotifications } from '../../context/NotificationContext';
import { Check, ChevronLeft, ChevronRight, Minus, Plus, ShoppingBag } from 'lucide-react';
import Skeleton from '../../components/Skeleton';

const steps = ['Size', 'Flowers', 'Colors', 'Fillers', 'Wrapper', 'Add-ons'];

const money = formatPrice;
const stockBadge = 'kawaii-badge bg-[#FDDDE6] border-[#F9A8C9] text-[#C4658A] text-xs px-2 py-0.5';
const getColorName = (color) => color?.color_name || color?.name || '';
const getSelectedWrapperColorName = (selectedWrapperColorId, wrapperColors) => {
  const color = wrapperColors.find(c => String(c.id) === String(selectedWrapperColorId));
  return getColorName(color);
};
const getSelectedFillerColorName = (selectedFillerColor, colors, fillerId) => {
  const selectedColorId = typeof selectedFillerColor === 'object' ? selectedFillerColor?.id : selectedFillerColor;
  const colorRow = colors.find(c => String(c.id) === String(selectedColorId) && String(c.filler_id) === String(fillerId));
  return getColorName(colorRow) || (typeof selectedFillerColor === 'object' ? selectedFillerColor?.colorName : '') || '';
};
const getSelectedColorName = (selectedColor, colors, flowerId, flowerName) => {
  const selectedColorId = typeof selectedColor === 'object' ? selectedColor?.id : selectedColor;
  const colorRow = colors.find(c => String(c.id) === String(selectedColorId) && String(c.flower_id) === String(flowerId));
  const candidates = [
    getColorName(colorRow),
    typeof selectedColor === 'object' ? selectedColor?.colorName : '',
    typeof selectedColor === 'string' ? selectedColor : '',
  ];
  return candidates.find(name => name && name !== flowerName) || candidates.find(Boolean) || '';
};

const Customize = () => {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { showToast } = useNotifications();

  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [dbFlowers, setDbFlowers] = useState([]);
  const [dbFlowerColors, setDbFlowerColors] = useState([]);
  const [dbFillers, setDbFillers] = useState([]);
  const [dbFillerColors, setDbFillerColors] = useState([]);
  const [dbWrappers, setDbWrappers] = useState([]);
  const [dbWrapperColors, setDbWrapperColors] = useState([]);
  const [sizeOptions, setSizeOptions] = useState([]);
  const [addonOptions, setAddonOptions] = useState([]);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedFlowers, setSelectedFlowers] = useState({});
  const [selectedFlowerColors, setSelectedFlowerColors] = useState({});
  const [selectedFillers, setSelectedFillers] = useState({});
  const [selectedFillerColors, setSelectedFillerColors] = useState({});
  const [selectedWrapper, setSelectedWrapper] = useState(null);
  const [selectedWrapperColorId, setSelectedWrapperColorId] = useState(null);
  const [addons, setAddons] = useState({});
  const [message, setMessage] = useState('');
  const [instructions, setInstructions] = useState('');
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

  const selectedAddonOptions = useMemo(
    () => addonOptions.filter(addon => addons[addon.key]),
    [addonOptions, addons]
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const [fRes, fcRes, filRes, ficRes, wRes, wcRes, sizeRes, addonRes] = await Promise.all([
        supabase.from('flowers').select('*').eq('is_available', true).gt('stock', 0),
        supabase.from('flower_colors').select('*').eq('is_available', true),
        supabase.from('fillers').select('*').eq('is_available', true).gt('stock', 0),
        supabase.from('filler_colors').select('*').eq('is_available', true),
        supabase.from('wrappers').select('*').eq('is_available', true),
        supabase.from('wrapper_colors').select('*').eq('is_available', true),
        supabase.from('bouquet_sizes').select('*').eq('is_available', true).order('display_order', { ascending: true }),
        supabase.from('bouquet_addons').select('*').eq('is_available', true).order('display_order', { ascending: true }),
      ]);

      if (fRes.data) setDbFlowers(fRes.data);
      if (fcRes.data) setDbFlowerColors(fcRes.data);
      if (filRes.data) setDbFillers(filRes.data);
      if (ficRes.data) setDbFillerColors(ficRes.data);
      if (wRes.data) setDbWrappers(wRes.data);
      if (wcRes.data) setDbWrapperColors(wcRes.data);
      if (sizeRes.data) {
        setSizeOptions(sizeRes.data);
        setSelectedSize(sizeRes.data.find(size => size.key === 'medium') || sizeRes.data[0] || null);
      }
      if (addonRes.data) {
        setAddonOptions(addonRes.data);
        setAddons(addonRes.data.reduce((acc, addon) => ({ ...acc, [addon.key]: false }), {}));
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('customize-flower-colors-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'flower_colors' },
        (payload) => {
          setDbFlowerColors(prev => {
            if (payload.eventType === 'DELETE') {
              return prev.filter(color => color.id !== payload.old?.id);
            }

            const nextColor = payload.new;
            if (!nextColor?.id) return prev;
            const exists = prev.some(color => color.id === nextColor.id);
            if (!nextColor.is_available) {
              return prev.filter(color => color.id !== nextColor.id);
            }

            return exists
              ? prev.map(color => color.id === nextColor.id ? { ...color, ...nextColor } : color)
              : [nextColor, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const calculateTotal = () => {
    let total = Number(selectedSize?.base_price || 0);
    Object.entries(selectedFlowers).forEach(([fId, qty]) => {
      const flower = dbFlowers.find(f => f.id === fId);
      if (flower) total += Number(flower.price_per_stem || 0) * qty;
    });
    Object.entries(selectedFillers).forEach(([filId, qty]) => {
      const filler = dbFillers.find(f => f.id === filId);
      if (filler) total += Number(filler.price || 0) * qty;
    });
    if (selectedWrapper) {
      const wrapper = dbWrappers.find(w => w.id === selectedWrapper);
      if (wrapper) total += Number(wrapper.price || 0);
    }
    selectedAddonOptions.forEach(addon => {
      total += Number(addon.price || 0);
    });
    return total;
  };

  const handleNext = () => {
    if (currentStep === 2) {
      const missingColor = Object.keys(selectedFlowers).some(fId => !selectedFlowerColors[fId]);
      if (missingColor) {
        showToast({
          type: 'error',
          title: 'Almost there!',
          message: 'Please select a color for each flower before continuing.'
        });
        return;
      }
    }
    if (currentStep === 3) {
      const missingColor = Object.keys(selectedFillers).some(fId => (
        fillerColorsForFiller(fId).length > 0 && !selectedFillerColors[fId]
      ));
      if (missingColor) {
        showToast({
          type: 'error',
          title: 'Almost there!',
          message: 'Please select a color for each filler before continuing.'
        });
        return;
      }
    }
    if (currentStep < steps.length - 1) setCurrentStep(c => c + 1);
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(c => c - 1);
  };

  const handleAddToCart = async () => {
    if (!selectedSize) {
      showToast({ type: 'error', title: 'Oops!', message: 'Please choose an available bouquet size.' });
      setCurrentStep(0);
      return;
    }
    if (Object.keys(selectedFlowers).length === 0) {
      showToast({ type: 'error', title: 'Oops!', message: 'Please select at least one flower before adding a custom bouquet.' });
      setCurrentStep(1);
      return;
    }

    const buildDetails = {
      size: {
        id: selectedSize.key,
        key: selectedSize.key,
        name: selectedSize.name,
        stems: selectedSize.stems,
        basePrice: Number(selectedSize.base_price || 0),
      },
      flowers: Object.entries(selectedFlowers).map(([id, qty]) => {
        const f = dbFlowers.find(x => x.id === id);
        const colorName = getSelectedColorName(selectedFlowerColors[id], dbFlowerColors, id, f?.name) || null;
        return { id, name: f?.name, quantity: qty, color: colorName };
      }),
      fillers: Object.entries(selectedFillers).map(([id, qty]) => {
        const filler = dbFillers.find(x => x.id === id);
        const colorName = getSelectedFillerColorName(selectedFillerColors[id], dbFillerColors, id) || null;
        return { id, name: filler?.name, quantity: qty, color: colorName };
      }),
      wrapper: selectedWrapper ? {
        id: selectedWrapper,
        material: dbWrappers.find(x => x.id === selectedWrapper)?.material,
        color: getSelectedWrapperColorName(selectedWrapperColorId, dbWrapperColors),
      } : null,
      addons,
      addonDetails: selectedAddonOptions.map(addon => ({ key: addon.key, name: addon.name, price: Number(addon.price || 0) })),
      message,
      instructions,
    };

    const result = await addToCart({
      item_type: 'custom',
      name: 'Custom Bouquet',
      price: calculateTotal(),
      quantity: 1,
      custom_details: buildDetails,
      subtotal: calculateTotal(),
    });

    if (result?.ok === false) return;
    showToast({ type: 'success', title: 'Added to cart!', message: 'Your item has been added successfully.' });
    navigate('/cart');
  };

  const updateFlowerQty = (id, delta) => {
    const flower = dbFlowers.find(f => f.id === id);
    const maxStock = Number(flower?.stock || 0);
    setSelectedFlowers(prev => {
      const current = prev[id] || 0;
      const next = Math.min(maxStock, current + delta);
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[id];
        setSelectedFlowerColors(cPrev => {
          const cCopy = { ...cPrev };
          delete cCopy[id];
          return cCopy;
        });
        return copy;
      }
      return { ...prev, [id]: next };
    });
  };

  const updateFillerQty = (id, delta) => {
    const filler = dbFillers.find(f => f.id === id);
    const maxStock = Number(filler?.stock || 0);
    setSelectedFillers(prev => {
      const current = prev[id] || 0;
      const next = Math.min(maxStock, current + delta);
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[id];
        setSelectedFillerColors(cPrev => {
          const cCopy = { ...cPrev };
          delete cCopy[id];
          return cCopy;
        });
        return copy;
      }
      return { ...prev, [id]: next };
    });
  };

  const renderImage = (item, label) => (
    <div className="w-full aspect-square bg-astraea-blush rounded-lg mb-4 flex items-center justify-center overflow-hidden">
      {item.image_url ? <img src={item.image_url} alt={label} className="w-full h-full object-cover" /> : <span className="text-astraea-pink/30">{label} icon</span>}
    </div>
  );

  const colorsForFlower = (flowerId) => {
    return dbFlowerColors.filter(fc => fc.flower_id === flowerId);
  };

  const fillerColorsForFiller = (fillerId) => {
    return dbFillerColors.filter(fc => fc.filler_id === fillerId);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6 animate-fade-in">
            <h2 className="font-heading text-xl md:text-3xl font-bold text-astraea-darkgray">What size bouquet?</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {sizeOptions.map(size => (
                <div
                  key={size.id}
                  onClick={() => setSelectedSize(size)}
                  className={`cursor-pointer rounded-2xl p-4 md:p-6 border-2 transition-all ${selectedSize?.id === size.id ? 'border-astraea-pink bg-astraea-pink/5 shadow-md' : 'border-astraea-rosegold/30 hover:border-astraea-pink/50'}`}
                >
                  <h3 className="font-heading text-2xl font-bold mb-2">{size.name}</h3>
                  <p className="text-astraea-darkgray/70 mb-4">{size.stems}</p>
                  <p className="font-bold text-astraea-pink text-xl">+{money(size.base_price)} base</p>
                </div>
              ))}
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-6 animate-fade-in">
            <h2 className="font-heading text-xl md:text-3xl font-bold text-astraea-darkgray">Pick your flowers</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {dbFlowers.map(f => {
                const qty = selectedFlowers[f.id] || 0;
                return (
                  <div key={f.id} className="bg-white rounded-xl border border-astraea-rosegold/20 p-4 flex flex-col h-full shadow-sm">
                    {renderImage(f, f.name)}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-astraea-darkgray flex-grow">{f.name}</h3>
                      <span className={stockBadge}>{f.stock} left</span>
                    </div>
                    <p className="text-astraea-pink text-sm mb-4">{money(f.price_per_stem)}/stem</p>
                    <div className="flex items-center justify-between border border-astraea-rosegold/40 rounded-full bg-astraea-blush/20">
                      <button onClick={() => updateFlowerQty(f.id, -1)} className="min-h-11 min-w-11 flex items-center justify-center text-astraea-darkgray hover:text-astraea-pink">-</button>
                      <span className="font-bold">{qty}</span>
                      <button onClick={() => updateFlowerQty(f.id, 1)} disabled={qty >= Number(f.stock || 0)} className="min-h-11 min-w-11 flex items-center justify-center text-astraea-darkgray hover:text-astraea-pink disabled:text-gray-300">+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      case 2: {
        const selectedFlowerObjs = dbFlowers.filter(f => selectedFlowers[f.id] > 0);
        if (selectedFlowerObjs.length === 0) {
          return <div className="py-12 text-center animate-fade-in"><p className="text-astraea-darkgray/70">You didn't select any flowers. Go back to Step 2 to choose some!</p></div>;
        }
        return (
          <div className="space-y-8 animate-fade-in">
            <h2 className="font-heading text-xl md:text-3xl font-bold text-astraea-darkgray">Pick your colors</h2>
            <p className="text-astraea-darkgray/70 -mt-6">Choose one main color per flower type you selected.</p>
            <div className="space-y-8">
              {selectedFlowerObjs.map(f => {
                const availableColors = colorsForFlower(f.id);
                return (
                  <div key={f.id} className="bg-white p-6 rounded-xl border border-astraea-rosegold/20">
                    <h3 className="font-bold text-lg mb-4">{f.name} Colors <span className="font-normal text-sm text-astraea-darkgray/50 ml-2">({selectedFlowers[f.id]} stems)</span></h3>
                    <div className="flex flex-wrap gap-4">
                      {availableColors.length > 0 ? availableColors.map(c => (
                        <button
                          key={c.id}
                          onClick={() => setSelectedFlowerColors(prev => ({ ...prev, [f.id]: { id: c.id, colorName: getColorName(c) } }))}
                          className={`min-w-11 min-h-11 w-12 h-12 rounded-full border-4 transition-all focus:outline-none ${selectedFlowerColors[f.id]?.id === c.id ? 'border-astraea-pink scale-110 shadow-lg' : 'border-transparent shadow-sm hover:scale-105'}`}
                          style={{ backgroundColor: c.hex_code }}
                          title={getColorName(c)}
                        />
                      )) : <p className="text-sm text-red-500">No colors available for this flower.</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }
      case 3:
        return (
          <div className="space-y-6 animate-fade-in">
            <h2 className="font-heading text-xl md:text-3xl font-bold text-astraea-darkgray">Add some fillers</h2>
            <p className="text-astraea-darkgray/70 -mt-4">This step is completely optional.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {dbFillers.map(f => {
                const qty = selectedFillers[f.id] || 0;
                const availableColors = fillerColorsForFiller(f.id);

                return (
                <div
                  key={f.id}
                  className={`flex gap-4 p-4 rounded-xl border-2 transition-all ${qty > 0 ? 'border-astraea-pink bg-astraea-pink/5' : 'border-astraea-rosegold/20 hover:border-astraea-pink/30'}`}
                >
                  <div className="w-20 h-20 shrink-0 overflow-hidden bg-astraea-blush rounded-lg flex items-center justify-center">
                    {f.image_url ? <img src={f.image_url} alt={f.name} className="w-full h-full object-cover" /> : <span className="text-astraea-pink/30 text-xs">{f.name}</span>}
                  </div>
                  <div className="flex flex-1 flex-col gap-3 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="font-bold block truncate">{f.name}</span>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className={stockBadge}>{f.stock} left</span>
                          <span className="text-astraea-pink font-medium">+{money(f.price)} each</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center border border-astraea-rosegold/40 rounded-full bg-white">
                        <button onClick={() => updateFillerQty(f.id, -1)} className="min-h-11 min-w-11 flex items-center justify-center text-astraea-darkgray hover:text-astraea-pink"><Minus className="w-4 h-4" /></button>
                        <span className="w-8 text-center font-bold">{qty}</span>
                        <button onClick={() => updateFillerQty(f.id, 1)} disabled={qty >= Number(f.stock || 0)} className="min-h-11 min-w-11 flex items-center justify-center text-astraea-darkgray hover:text-astraea-pink disabled:text-gray-300"><Plus className="w-4 h-4" /></button>
                      </div>
                    </div>
                    {qty > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-bold text-astraea-darkgray/60">Color</p>
                        <div className="flex flex-wrap gap-3">
                          {availableColors.length > 0 ? availableColors.map(c => (
                            <button
                              key={c.id}
                              onClick={() => setSelectedFillerColors(prev => ({ ...prev, [f.id]: { id: c.id, colorName: getColorName(c) } }))}
                              className={`min-w-11 min-h-11 w-11 h-11 rounded-full border-4 transition-all focus:outline-none ${selectedFillerColors[f.id]?.id === c.id ? 'border-astraea-pink scale-110 shadow-lg' : 'border-transparent shadow-sm hover:scale-105'}`}
                              style={{ backgroundColor: c.hex_code }}
                              title={getColorName(c)}
                            />
                          )) : <p className="text-sm text-astraea-darkgray/50">No color options for this filler.</p>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
              })}
            </div>
          </div>
        );
      case 4: {
        const activeWrapperColors = selectedWrapper ? dbWrapperColors.filter(wc => wc.wrapper_id === selectedWrapper) : [];
        return (
          <div className="space-y-8 animate-fade-in">
            <h2 className="font-heading text-xl md:text-3xl font-bold text-astraea-darkgray">Pick your wrapper</h2>
            <div className="grid grid-cols-3 gap-2">
              {dbWrappers.map(w => (
                <div
                  key={w.id}
                  onClick={() => {
                    setSelectedWrapper(w.id);
                    setSelectedWrapperColorId(null);
                  }}
                  className={`cursor-pointer overflow-hidden rounded-[12px] border-2 bg-white text-center transition-all ${selectedWrapper === w.id ? 'border-dashed border-[#F9A8C9] shadow-[3px_3px_0px_#F9A8C9]' : 'border-astraea-rosegold/20 hover:border-astraea-pink/30'}`}
                >
                  <div className="relative w-full aspect-square overflow-hidden rounded-t-[12px] bg-astraea-blush">
                    {w.image_url ? (
                      <img
                        src={w.image_url}
                        alt={w.material}
                        className="h-full w-full object-cover object-center"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center px-2 text-center text-astraea-pink/30 text-sm">{w.material}</span>
                    )}
                    {selectedWrapper === w.id && (
                      <span className="absolute right-1 top-1 inline-flex items-center rounded-full border border-[#F9A8C9] bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#C4658A] shadow-[1px_1px_0px_#F9A8C9]">
                        ✓ Selected
                      </span>
                    )}
                  </div>
                  <h3 className="px-1 py-1 pb-0.5 text-center text-xs font-bold font-heading truncate">{w.material}</h3>
                  <span className="block px-1 pb-1.5 text-center text-xs font-accent text-[#8B6914]">+{money(w.price)}</span>
                </div>
              ))}
            </div>
            {selectedWrapper && (
              <div className="bg-white p-6 rounded-xl border border-astraea-rosegold/20 animate-fade-in">
                <h3 className="font-bold mb-4">Wrapper Color</h3>
                <div className="flex flex-wrap gap-4">
                  {activeWrapperColors.length > 0 ? activeWrapperColors.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedWrapperColorId(c.id)}
                      className={`min-w-11 min-h-11 w-12 h-12 rounded-full border-4 transition-all focus:outline-none ${String(selectedWrapperColorId) === String(c.id) ? 'border-astraea-pink scale-110 shadow-lg' : 'border-transparent shadow-sm hover:scale-105'}`}
                      style={{ backgroundColor: c.hex_code }}
                      title={c.color_name}
                    />
                  )) : <p className="text-sm text-red-500">No colors available for this wrapper.</p>}
                </div>
              </div>
            )}
          </div>
        );
      }
      case 5:
        return (
          <div className="space-y-8 animate-fade-in">
            <h2 className="font-heading text-xl md:text-3xl font-bold text-astraea-darkgray">Final touches</h2>
            <div className="space-y-4">
              {addonOptions.map(addon => (
                <label key={addon.id} className="flex items-center p-4 rounded-xl border border-astraea-rosegold/20 cursor-pointer hover:bg-astraea-blush/30 transition-colors">
                  <input type="checkbox" checked={!!addons[addon.key]} onChange={e => setAddons({ ...addons, [addon.key]: e.target.checked })} className="w-5 h-5 accent-astraea-pink mr-4" />
                  <span className="font-bold flex-grow">{addon.name}</span>
                  <span className="text-astraea-pink font-medium">+{money(addon.price)}</span>
                </label>
              ))}
            </div>
            {addons.messageCard && (
              <div className="animate-fade-in">
                <label className="block text-sm font-bold text-astraea-darkgray mb-2">Message</label>
                <textarea rows="3" value={message} onChange={e => setMessage(e.target.value)} className="w-full border border-astraea-rosegold/40 rounded-xl p-4 focus:ring-2 focus:ring-astraea-pink outline-none" placeholder="Type your message here..." />
              </div>
            )}
            <div>
              <label className="block text-sm font-bold text-astraea-darkgray mb-2">Special Instructions (Optional)</label>
              <textarea rows="2" value={instructions} onChange={e => setInstructions(e.target.value)} className="w-full border border-astraea-rosegold/40 rounded-xl p-4 focus:ring-2 focus:ring-astraea-pink outline-none" placeholder="E.g., wrap it tight, mix the colors evenly..." />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-astraea-blush/30 py-8 pb-28 lg:pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Steps Indicator Skeleton */}
          <div className="mb-8 md:mb-12 overflow-x-auto pb-4 md:pb-8 pt-2 px-2">
            <div className="flex items-center min-w-max justify-center md:justify-start">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <React.Fragment key={i}>
                  <div className="flex flex-col items-center relative">
                    <Skeleton className="w-8 h-8 rounded-full" />
                  </div>
                  {i < 6 && <div className="w-12 sm:w-20 h-1 mx-2 bg-astraea-rosegold/30" />}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-8 animate-fade-in">
            {/* Left box skeleton */}
            <div className="lg:w-2/3 bg-white p-4 sm:p-8 lg:p-10 rounded-2xl border border-astraea-rosegold/20 min-h-[500px] flex flex-col justify-between shadow-sm">
              <div className="space-y-6">
                <Skeleton className="w-48 h-8 mb-6" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="rounded-2xl p-4 md:p-6 border border-gray-150 space-y-4 bg-white/50">
                      <Skeleton className="w-24 h-6" />
                      <Skeleton className="w-32 h-4" />
                      <Skeleton className="w-20 h-6" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center mt-12 pt-6 border-t border-gray-100">
                <Skeleton className="w-20 h-10 rounded-full" />
                <Skeleton className="w-32 h-10 rounded-full" />
              </div>
            </div>

            {/* Right SummaryPanel skeleton */}
            <div className="hidden lg:block lg:w-1/3 bg-astraea-darkgray p-6 rounded-2xl space-y-6 shadow-lg">
              <Skeleton className="w-32 h-6 bg-white/10" />
              <div className="space-y-4">
                <div className="flex justify-between pb-2 border-b border-white/10">
                  <Skeleton className="w-12 h-4 bg-white/10" />
                  <Skeleton className="w-24 h-4 bg-white/10" />
                </div>
              </div>
              <div className="mt-8 pt-4 border-t border-white/20 flex justify-between items-center">
                <Skeleton className="w-12 h-6 bg-white/10" />
                <Skeleton className="w-24 h-8 bg-white/10" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-astraea-blush/30 py-8 pb-28 lg:pb-8 fade-in-content">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 md:mb-12 overflow-x-auto pb-4 md:pb-8 pt-2 px-2">
          <div className="flex items-center min-w-max justify-center md:justify-start">
            {steps.map((step, idx) => (
              <React.Fragment key={step}>
                <div className="flex flex-col items-center relative">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm z-10 transition-colors duration-300 ${currentStep > idx ? 'bg-astraea-pink text-white' : currentStep === idx ? 'bg-astraea-pink text-white ring-4 ring-astraea-pink/20' : 'bg-white border-2 border-astraea-rosegold/30 text-astraea-darkgray/50'}`}>
                    {currentStep > idx ? <Check className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span className={`hidden md:block absolute top-10 text-xs font-bold whitespace-nowrap ${currentStep >= idx ? 'text-astraea-darkgray' : 'text-astraea-darkgray/40'}`}>{step}</span>
                </div>
                {idx < steps.length - 1 && <div className={`w-12 sm:w-20 h-1 mx-2 transition-colors duration-300 ${currentStep > idx ? 'bg-astraea-pink' : 'bg-astraea-rosegold/30'}`} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-2/3 bg-white p-4 sm:p-8 lg:p-10 rounded-2xl shadow-sm border border-astraea-rosegold/20 min-h-[500px] flex flex-col">
            <div className="flex-grow">{renderStepContent()}</div>
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 mt-12 pt-6 border-t border-astraea-rosegold/20">
              <button onClick={handleBack} disabled={currentStep === 0} className={`min-h-11 flex items-center justify-center px-6 py-3 rounded-full font-bold transition-colors ${currentStep === 0 ? 'text-astraea-darkgray/30 cursor-not-allowed' : 'text-astraea-darkgray hover:bg-astraea-blush'}`}>
                <ChevronLeft className="w-5 h-5 mr-1" /> Back
              </button>
              {currentStep < steps.length - 1 ? (
                <button onClick={handleNext} className="min-h-11 flex items-center justify-center px-8 py-3 bg-astraea-pink text-white rounded-full font-bold hover:bg-astraea-pink/90 transition-colors">Next <ChevronRight className="w-5 h-5 ml-1" /></button>
              ) : (
                <button onClick={handleAddToCart} className="min-h-11 flex items-center justify-center px-8 py-3 bg-astraea-pink text-white rounded-full font-bold hover:bg-astraea-pink/90 transition-colors shadow-md"><ShoppingBag className="w-5 h-5 mr-2" /> Add to Cart</button>
              )}
            </div>
          </div>

          <div className="hidden lg:block lg:w-1/3">
            <SummaryPanel
              selectedSize={selectedSize}
              selectedFlowers={selectedFlowers}
              selectedFlowerColors={selectedFlowerColors}
              dbFlowerColors={dbFlowerColors}
              dbFlowers={dbFlowers}
              selectedFillers={selectedFillers}
              selectedFillerColors={selectedFillerColors}
              dbFillerColors={dbFillerColors}
              dbFillers={dbFillers}
              selectedWrapper={selectedWrapper}
              selectedWrapperColorId={selectedWrapperColorId}
              dbWrapperColors={dbWrapperColors}
              dbWrappers={dbWrappers}
              selectedAddonOptions={selectedAddonOptions}
              calculateTotal={calculateTotal}
            />
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 bg-astraea-darkgray text-white p-4 shadow-2xl lg:hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-white/70">Custom Bouquet</p>
            <p className="font-bold text-xl text-astraea-pink">{money(calculateTotal())}</p>
          </div>
          <button onClick={() => setIsSummaryOpen(true)} className="min-h-11 px-5 py-2 bg-astraea-pink text-white rounded-full font-bold">View Summary</button>
        </div>
      </div>

      {isSummaryOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 lg:hidden" onClick={() => setIsSummaryOpen(false)}>
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto bg-astraea-darkgray text-white p-6 rounded-t-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-2xl font-bold text-astraea-pink">Your Bouquet</h3>
              <button onClick={() => setIsSummaryOpen(false)} className="min-h-11 min-w-11 text-white text-2xl">x</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-white/10 pb-2"><span className="text-white/80">Size</span><span>{selectedSize?.name}</span></div>
              <div className="flex justify-between border-b border-white/10 pb-2"><span className="text-white/80">Flowers</span><span>{Object.values(selectedFlowers).reduce((sum, qty) => sum + qty, 0)} stems</span></div>
              <div className="flex justify-between pt-4"><span className="text-white/80 text-lg">Total</span><span className="font-bold text-3xl text-astraea-pink">{money(calculateTotal())}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryPanel = ({ selectedSize, selectedFlowers, selectedFlowerColors, dbFlowerColors, dbFlowers, selectedFillers, selectedFillerColors, dbFillerColors, dbFillers, selectedWrapper, selectedWrapperColorId, dbWrapperColors, dbWrappers, selectedAddonOptions, calculateTotal }) => (
  <div className="bg-astraea-darkgray text-white p-6 rounded-2xl sticky top-28 shadow-lg">
    <h3 className="font-heading text-2xl font-bold mb-6 text-astraea-pink">Your Bouquet</h3>
    <div className="space-y-4 text-sm font-medium">
      {selectedSize && <div className="flex justify-between border-b border-white/10 pb-2"><span className="text-white/80">Size</span><span>{selectedSize.name} ({money(selectedSize.base_price)})</span></div>}
      {Object.keys(selectedFlowers).length > 0 && (
        <div className="border-b border-white/10 pb-2">
          <span className="text-white/80 block mb-2">Flowers</span>
          {Object.entries(selectedFlowers).map(([fId, qty]) => {
            const f = dbFlowers.find(x => x.id === fId);
            const colorName = getSelectedColorName(selectedFlowerColors[fId], dbFlowerColors, fId, f?.name);
            const color = colorName ? ` - ${colorName}` : '';
            return f ? <div key={fId} className="flex justify-between text-white/90 ml-2 mb-1"><span>{qty}x {f.name}{color}</span><span>{money(Number(f.price_per_stem || 0) * qty)}</span></div> : null;
          })}
        </div>
      )}
      {Object.keys(selectedFillers).length > 0 && (
        <div className="border-b border-white/10 pb-2">
          <span className="text-white/80 block mb-2">Fillers</span>
          {Object.entries(selectedFillers).map(([fId, qty]) => {
            const f = dbFillers.find(x => x.id === fId);
            const colorName = getSelectedFillerColorName(selectedFillerColors[fId], dbFillerColors, fId);
            const color = colorName ? ` - ${colorName}` : '';
            return f ? <div key={fId} className="flex justify-between text-white/90 ml-2 mb-1"><span>{qty}x {f.name}{color}</span><span>{money(Number(f.price || 0) * qty)}</span></div> : null;
          })}
        </div>
      )}
      {selectedWrapper && (
        <div className="flex justify-between border-b border-white/10 pb-2">
          <span className="text-white/80">Wrapper</span>
          <span>{dbWrappers.find(w => w.id === selectedWrapper)?.material}{selectedWrapperColorId ? ` (${getSelectedWrapperColorName(selectedWrapperColorId, dbWrapperColors)})` : ''} ({money(dbWrappers.find(w => w.id === selectedWrapper)?.price)})</span>
        </div>
      )}
      {selectedAddonOptions.length > 0 && (
        <div className="border-b border-white/10 pb-2">
          <span className="text-white/80 block mb-2">Add-ons</span>
          {selectedAddonOptions.map(addon => <div key={addon.key} className="flex justify-between text-white/90 ml-2 mb-1"><span>{addon.name}</span><span>{money(addon.price)}</span></div>)}
        </div>
      )}
    </div>
    <div className="mt-8 pt-4 border-t border-white/20 flex justify-between items-end">
      <span className="text-white/80 text-lg">Total</span>
      <span className="font-bold text-3xl text-astraea-pink">{money(calculateTotal())}</span>
    </div>
  </div>
);

export default Customize;
