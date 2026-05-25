import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useCart } from '../../context/CartContext';
import { Check, ChevronRight, ChevronLeft, ShoppingBag } from 'lucide-react';

const steps = [
  'Size',
  'Flowers',
  'Colors',
  'Fillers',
  'Wrapper',
  'Add-ons'
];

const sizeOptions = [
  { id: 'small', name: 'Small', stems: '5–8 stems', basePrice: 150 },
  { id: 'medium', name: 'Medium', stems: '10–15 stems', basePrice: 250 },
  { id: 'large', name: 'Large', stems: '18–25 stems', basePrice: 400 },
];

const Customize = () => {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  
  const [currentStep, setCurrentStep] = useState(0);
  
  // Data from DB
  const [dbFlowers, setDbFlowers] = useState([]);
  const [dbFlowerColors, setDbFlowerColors] = useState([]);
  const [dbFillers, setDbFillers] = useState([]);
  const [dbWrappers, setDbWrappers] = useState([]);
  const [dbWrapperColors, setDbWrapperColors] = useState([]);
  
  // Selections
  const [selectedSize, setSelectedSize] = useState(sizeOptions[1]); // default Medium
  const [selectedFlowers, setSelectedFlowers] = useState({}); // { flowerId: quantity }
  const [selectedFlowerColors, setSelectedFlowerColors] = useState({}); // { flowerId: colorName }
  const [selectedFillers, setSelectedFillers] = useState({}); // { fillerId: true }
  const [selectedWrapper, setSelectedWrapper] = useState(null);
  const [selectedWrapperColor, setSelectedWrapperColor] = useState(null);
  
  const [addons, setAddons] = useState({ ribbon: false, messageCard: false });
  const [message, setMessage] = useState('');
  const [instructions, setInstructions] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const [fRes, fcRes, filRes, wRes, wcRes] = await Promise.all([
        supabase.from('flowers').select('*'),
        supabase.from('flower_colors').select('*').eq('is_available', true),
        supabase.from('fillers').select('*').eq('is_available', true),
        supabase.from('wrappers').select('*'),
        supabase.from('wrapper_colors').select('*').eq('is_available', true)
      ]);
      
      if (fRes.data) setDbFlowers(fRes.data);
      if (fcRes.data) setDbFlowerColors(fcRes.data);
      if (filRes.data) setDbFillers(filRes.data);
      if (wRes.data) setDbWrappers(wRes.data);
      if (wcRes.data) setDbWrapperColors(wcRes.data);
    };
    fetchData();
  }, []);

  // Calculate Total
  const calculateTotal = () => {
    let total = selectedSize?.basePrice || 0;
    
    // Flowers
    Object.entries(selectedFlowers).forEach(([fId, qty]) => {
      const flower = dbFlowers.find(f => f.id === fId);
      if (flower) total += flower.price_per_stem * qty;
    });
    
    // Fillers
    Object.keys(selectedFillers).forEach(filId => {
      const filler = dbFillers.find(f => f.id === filId);
      if (filler) total += filler.price;
    });
    
    // Wrapper
    if (selectedWrapper) {
      const wrapper = dbWrappers.find(w => w.id === selectedWrapper);
      if (wrapper) total += wrapper.price;
    }
    
    // Add-ons
    if (addons.ribbon) total += 20;
    if (addons.messageCard) total += 15;
    
    return total;
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) setCurrentStep(c => c + 1);
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(c => c - 1);
  };

  const handleAddToCart = () => {
    if (Object.keys(selectedFlowers).length === 0) {
      alert('Please select at least one flower before adding a custom bouquet.');
      setCurrentStep(1);
      return;
    }

    const buildDetails = {
      size: selectedSize,
      flowers: Object.entries(selectedFlowers).map(([id, qty]) => {
        const f = dbFlowers.find(x => x.id === id);
        return { id, name: f.name, quantity: qty, color: selectedFlowerColors[id] };
      }),
      fillers: Object.keys(selectedFillers).map(id => {
        const filler = dbFillers.find(x => x.id === id);
        return { id, name: filler?.name };
      }),
      wrapper: selectedWrapper ? {
        id: selectedWrapper,
        material: dbWrappers.find(x => x.id === selectedWrapper)?.material,
        color: selectedWrapperColor
      } : null,
      addons,
      message,
      instructions
    };

    addToCart({
      item_type: 'custom',
      name: 'Custom Bouquet',
      price: calculateTotal(),
      quantity: 1,
      custom_details: buildDetails,
      subtotal: calculateTotal()
    });
    alert('Custom bouquet added to cart!');
    navigate('/cart');
  };

  // Handlers for Flowers Step
  const updateFlowerQty = (id, delta) => {
    setSelectedFlowers(prev => {
      const current = prev[id] || 0;
      const next = current + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[id];
        // also remove selected color if qty goes to 0
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

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Size
        return (
          <div className="space-y-6 animate-fade-in">
            <h2 className="font-heading text-3xl font-bold text-astraea-darkgray">What size bouquet?</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {sizeOptions.map(size => (
                <div 
                  key={size.id}
                  onClick={() => setSelectedSize(size)}
                  className={`cursor-pointer rounded-2xl p-6 border-2 transition-all ${
                    selectedSize?.id === size.id 
                      ? 'border-astraea-pink bg-astraea-pink/5 shadow-md' 
                      : 'border-astraea-rosegold/30 hover:border-astraea-pink/50'
                  }`}
                >
                  <h3 className="font-heading text-2xl font-bold mb-2">{size.name}</h3>
                  <p className="text-astraea-darkgray/70 mb-4">{size.stems}</p>
                  <p className="font-bold text-astraea-pink text-xl">+₱{size.basePrice} base</p>
                </div>
              ))}
            </div>
          </div>
        );
      
      case 1: // Flowers
        return (
          <div className="space-y-6 animate-fade-in">
            <h2 className="font-heading text-3xl font-bold text-astraea-darkgray">Pick your flowers</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {dbFlowers.map(f => {
                const qty = selectedFlowers[f.id] || 0;
                return (
                  <div key={f.id} className="bg-white rounded-xl border border-astraea-rosegold/20 p-4 flex flex-col h-full shadow-sm">
                    <div className="w-full aspect-square bg-astraea-blush rounded-lg mb-4 flex items-center justify-center">
                      <span className="text-astraea-pink/30">{f.name} icon</span>
                    </div>
                    <h3 className="font-bold text-astraea-darkgray flex-grow">{f.name}</h3>
                    <p className="text-astraea-pink text-sm mb-4">₱{f.price_per_stem}/stem</p>
                    
                    <div className="flex items-center justify-between border border-astraea-rosegold/40 rounded-full bg-astraea-blush/20">
                      <button onClick={() => updateFlowerQty(f.id, -1)} className="w-8 h-8 flex items-center justify-center text-astraea-darkgray hover:text-astraea-pink">-</button>
                      <span className="font-bold">{qty}</span>
                      <button onClick={() => updateFlowerQty(f.id, 1)} className="w-8 h-8 flex items-center justify-center text-astraea-darkgray hover:text-astraea-pink">+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 2: { // Colors
        const selectedFlowerObjs = dbFlowers.filter(f => selectedFlowers[f.id] > 0);
        if (selectedFlowerObjs.length === 0) {
          return (
            <div className="py-12 text-center animate-fade-in">
              <p className="text-astraea-darkgray/70">You didn't select any flowers. Go back to Step 2 to choose some!</p>
            </div>
          );
        }
        return (
          <div className="space-y-8 animate-fade-in">
            <h2 className="font-heading text-3xl font-bold text-astraea-darkgray">Pick your colors</h2>
            <p className="text-astraea-darkgray/70 -mt-6">Choose one main color per flower type you selected.</p>
            
            <div className="space-y-8">
              {selectedFlowerObjs.map(f => {
                const colorsForFlower = dbFlowerColors.filter(fc => fc.flower_id === f.id);
                return (
                  <div key={f.id} className="bg-white p-6 rounded-xl border border-astraea-rosegold/20">
                    <h3 className="font-bold text-lg mb-4">{f.name} Colors <span className="font-normal text-sm text-astraea-darkgray/50 ml-2">({selectedFlowers[f.id]} stems)</span></h3>
                    <div className="flex flex-wrap gap-4">
                      {colorsForFlower.length > 0 ? colorsForFlower.map(c => (
                        <button
                          key={c.id}
                          onClick={() => setSelectedFlowerColors(prev => ({...prev, [f.id]: c.color_name}))}
                          className={`w-12 h-12 rounded-full border-4 transition-all focus:outline-none ${
                            selectedFlowerColors[f.id] === c.color_name ? 'border-astraea-pink scale-110 shadow-lg' : 'border-transparent shadow-sm hover:scale-105'
                          }`}
                          style={{ backgroundColor: c.hex_code }}
                          title={c.color_name}
                        ></button>
                      )) : <p className="text-sm text-red-500">No colors available for this flower.</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      case 3: // Fillers
        return (
          <div className="space-y-6 animate-fade-in">
            <h2 className="font-heading text-3xl font-bold text-astraea-darkgray">Add some fillers</h2>
            <p className="text-astraea-darkgray/70 -mt-4">This step is completely optional.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {dbFillers.map(f => (
                <div 
                  key={f.id}
                  onClick={() => setSelectedFillers(prev => {
                    const copy = {...prev};
                    if (copy[f.id]) delete copy[f.id];
                    else copy[f.id] = true;
                    return copy;
                  })}
                  className={`cursor-pointer flex justify-between items-center p-4 rounded-xl border-2 transition-all ${
                    selectedFillers[f.id] ? 'border-astraea-pink bg-astraea-pink/5' : 'border-astraea-rosegold/20 hover:border-astraea-pink/30'
                  }`}
                >
                  <div className="flex items-center">
                    <div className={`w-6 h-6 rounded-full border-2 mr-4 flex items-center justify-center ${
                      selectedFillers[f.id] ? 'border-astraea-pink bg-astraea-pink' : 'border-astraea-rosegold/40'
                    }`}>
                      {selectedFillers[f.id] && <Check className="w-4 h-4 text-white" />}
                    </div>
                    <span className="font-bold">{f.name}</span>
                  </div>
                  <span className="text-astraea-pink font-medium">+₱{f.price}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case 4: { // Wrapper
        const activeWrapperColors = selectedWrapper ? dbWrapperColors.filter(wc => wc.wrapper_id === selectedWrapper) : [];
        return (
          <div className="space-y-8 animate-fade-in">
            <h2 className="font-heading text-3xl font-bold text-astraea-darkgray">Pick your wrapper</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {dbWrappers.map(w => (
                <div
                  key={w.id}
                  onClick={() => {
                    setSelectedWrapper(w.id);
                    setSelectedWrapperColor(null);
                  }}
                  className={`cursor-pointer p-4 rounded-xl border-2 text-center transition-all ${
                    selectedWrapper === w.id ? 'border-astraea-pink bg-astraea-pink/5' : 'border-astraea-rosegold/20 hover:border-astraea-pink/30'
                  }`}
                >
                  <h3 className="font-bold mb-2">{w.material}</h3>
                  <span className="text-astraea-pink text-sm font-medium">+₱{w.price}</span>
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
                      onClick={() => setSelectedWrapperColor(c.color_name)}
                      className={`w-12 h-12 rounded-full border-4 transition-all focus:outline-none ${
                        selectedWrapperColor === c.color_name ? 'border-astraea-pink scale-110 shadow-lg' : 'border-transparent shadow-sm hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.hex_code }}
                      title={c.color_name}
                    ></button>
                  )) : <p className="text-sm text-red-500">No colors available for this wrapper.</p>}
                </div>
              </div>
            )}
          </div>
        );
      }

      case 5: // Add-ons
        return (
          <div className="space-y-8 animate-fade-in">
            <h2 className="font-heading text-3xl font-bold text-astraea-darkgray">Final touches</h2>
            
            <div className="space-y-4">
              <label className="flex items-center p-4 rounded-xl border border-astraea-rosegold/20 cursor-pointer hover:bg-astraea-blush/30 transition-colors">
                <input 
                  type="checkbox" 
                  checked={addons.ribbon}
                  onChange={(e) => setAddons({...addons, ribbon: e.target.checked})}
                  className="w-5 h-5 accent-astraea-pink mr-4"
                />
                <span className="font-bold flex-grow">Premium Satin Ribbon</span>
                <span className="text-astraea-pink font-medium">+₱20</span>
              </label>
              
              <label className="flex items-center p-4 rounded-xl border border-astraea-rosegold/20 cursor-pointer hover:bg-astraea-blush/30 transition-colors">
                <input 
                  type="checkbox" 
                  checked={addons.messageCard}
                  onChange={(e) => setAddons({...addons, messageCard: e.target.checked})}
                  className="w-5 h-5 accent-astraea-pink mr-4"
                />
                <span className="font-bold flex-grow">Message Card</span>
                <span className="text-astraea-pink font-medium">+₱15</span>
              </label>
            </div>
            
            {addons.messageCard && (
              <div className="animate-fade-in">
                <label className="block text-sm font-bold text-astraea-darkgray mb-2">Message</label>
                <textarea 
                  rows="3" 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full border border-astraea-rosegold/40 rounded-xl p-4 focus:ring-2 focus:ring-astraea-pink outline-none"
                  placeholder="Type your message here..."
                ></textarea>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-astraea-darkgray mb-2">Special Instructions (Optional)</label>
              <textarea 
                rows="2" 
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full border border-astraea-rosegold/40 rounded-xl p-4 focus:ring-2 focus:ring-astraea-pink outline-none"
                placeholder="E.g., wrap it tight, mix the colors evenly..."
              ></textarea>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-astraea-blush/30 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Progress Bar */}
        <div className="mb-12 overflow-x-auto pb-8 pt-2 px-2">
          <div className="flex items-center min-w-max justify-center md:justify-start">
            {steps.map((step, idx) => (
              <React.Fragment key={idx}>
                <div className="flex flex-col items-center relative">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm z-10 transition-colors duration-300 ${
                    currentStep > idx ? 'bg-astraea-pink text-white' 
                    : currentStep === idx ? 'bg-astraea-pink text-white ring-4 ring-astraea-pink/20'
                    : 'bg-white border-2 border-astraea-rosegold/30 text-astraea-darkgray/50'
                  }`}>
                    {currentStep > idx ? <Check className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span className={`absolute top-10 text-xs font-bold whitespace-nowrap ${
                    currentStep >= idx ? 'text-astraea-darkgray' : 'text-astraea-darkgray/40'
                  }`}>{step}</span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`w-12 sm:w-20 h-1 mx-2 transition-colors duration-300 ${
                    currentStep > idx ? 'bg-astraea-pink' : 'bg-astraea-rosegold/30'
                  }`}></div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Builder Area */}
          <div className="lg:w-2/3 bg-white p-6 sm:p-10 rounded-2xl shadow-sm border border-astraea-rosegold/20 min-h-[500px] flex flex-col">
            
            <div className="flex-grow">
              {renderStepContent()}
            </div>
            
            {/* Navigation Buttons */}
            <div className="flex justify-between items-center mt-12 pt-6 border-t border-astraea-rosegold/20">
              <button 
                onClick={handleBack}
                disabled={currentStep === 0}
                className={`flex items-center px-6 py-3 rounded-full font-bold transition-colors ${
                  currentStep === 0 ? 'text-astraea-darkgray/30 cursor-not-allowed' : 'text-astraea-darkgray hover:bg-astraea-blush'
                }`}
              >
                <ChevronLeft className="w-5 h-5 mr-1" /> Back
              </button>
              
              {currentStep < steps.length - 1 ? (
                <button 
                  onClick={handleNext}
                  className="flex items-center px-8 py-3 bg-astraea-pink text-white rounded-full font-bold hover:bg-astraea-pink/90 transition-colors"
                >
                  Next <ChevronRight className="w-5 h-5 ml-1" />
                </button>
              ) : (
                <button 
                  onClick={handleAddToCart}
                  className="flex items-center px-8 py-3 bg-astraea-pink text-white rounded-full font-bold hover:bg-astraea-pink/90 transition-colors shadow-md"
                >
                  <ShoppingBag className="w-5 h-5 mr-2" /> Add to Cart
                </button>
              )}
            </div>
          </div>

          {/* Summary Panel (Sticky Desktop) */}
          <div className="lg:w-1/3">
            <div className="bg-astraea-darkgray text-white p-6 rounded-2xl sticky top-28 shadow-lg">
              <h3 className="font-heading text-2xl font-bold mb-6 text-astraea-pink">Your Bouquet</h3>
              
              <div className="space-y-4 text-sm font-medium">
                {selectedSize && (
                  <div className="flex justify-between border-b border-white/10 pb-2">
                    <span className="text-white/80">Size</span>
                    <span>{selectedSize.name} (₱{selectedSize.basePrice})</span>
                  </div>
                )}
                
                {Object.keys(selectedFlowers).length > 0 && (
                  <div className="border-b border-white/10 pb-2">
                    <span className="text-white/80 block mb-2">Flowers</span>
                    {Object.entries(selectedFlowers).map(([fId, qty]) => {
                      const f = dbFlowers.find(x => x.id === fId);
                      const color = selectedFlowerColors[fId] ? ` - ${selectedFlowerColors[fId]}` : '';
                      return f ? (
                        <div key={fId} className="flex justify-between text-white/90 ml-2 mb-1">
                          <span>{qty}x {f.name}{color}</span>
                          <span>₱{f.price_per_stem * qty}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                )}
                
                {Object.keys(selectedFillers).length > 0 && (
                  <div className="border-b border-white/10 pb-2">
                    <span className="text-white/80 block mb-2">Fillers</span>
                    {Object.keys(selectedFillers).map(fId => {
                      const f = dbFillers.find(x => x.id === fId);
                      return f ? (
                        <div key={fId} className="flex justify-between text-white/90 ml-2 mb-1">
                          <span>{f.name}</span>
                          <span>₱{f.price}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                )}
                
                {selectedWrapper && (
                  <div className="flex justify-between border-b border-white/10 pb-2">
                    <span className="text-white/80">Wrapper</span>
                    <span>
                      {dbWrappers.find(w => w.id === selectedWrapper)?.material} 
                      {selectedWrapperColor ? ` (${selectedWrapperColor})` : ''} 
                      (₱{dbWrappers.find(w => w.id === selectedWrapper)?.price})
                    </span>
                  </div>
                )}
                
                {(addons.ribbon || addons.messageCard) && (
                  <div className="border-b border-white/10 pb-2">
                    <span className="text-white/80 block mb-2">Add-ons</span>
                    {addons.ribbon && <div className="flex justify-between text-white/90 ml-2 mb-1"><span>Ribbon</span><span>₱20</span></div>}
                    {addons.messageCard && <div className="flex justify-between text-white/90 ml-2 mb-1"><span>Message Card</span><span>₱15</span></div>}
                  </div>
                )}
              </div>
              
              <div className="mt-8 pt-4 border-t border-white/20 flex justify-between items-end">
                <span className="text-white/80 text-lg">Total</span>
                <span className="font-bold text-3xl text-astraea-pink">₱{calculateTotal().toFixed(2)}</span>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default Customize;
