import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, X } from 'lucide-react';

const AdminInventory = () => {
  const [activeTab, setActiveTab] = useState('flowers');
  
  const [flowers, setFlowers] = useState([]);
  const [flowerColors, setFlowerColors] = useState([]);
  
  const [fillers, setFillers] = useState([]);
  
  const [wrappers, setWrappers] = useState([]);
  const [wrapperColors, setWrapperColors] = useState([]);

  const [loading, setLoading] = useState(true);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState(''); // 'add_flower', 'add_filler', 'add_wrapper', 'add_flower_color', 'add_wrapper_color'
  const [activeItem, setActiveItem] = useState(null); // Used when adding colors to specific item
  
  const [formData, setFormData] = useState({});

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
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

  const handleToggleAvailability = async (table, id, currentValue) => {
    const { error } = await supabase.from(table).update({ is_available: !currentValue }).eq('id', id);
    if (!error) {
      if (table === 'flower_colors') setFlowerColors(prev => prev.map(c => c.id === id ? {...c, is_available: !currentValue} : c));
      if (table === 'fillers') setFillers(prev => prev.map(f => f.id === id ? {...f, is_available: !currentValue} : f));
      if (table === 'wrapper_colors') setWrapperColors(prev => prev.map(c => c.id === id ? {...c, is_available: !currentValue} : c));
    }
  };

  const handleDelete = async (table, id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (!error) {
      if (table === 'flowers') setFlowers(prev => prev.filter(i => i.id !== id));
      if (table === 'fillers') setFillers(prev => prev.filter(i => i.id !== id));
      if (table === 'wrappers') setWrappers(prev => prev.filter(i => i.id !== id));
    } else {
      alert('Error deleting item. It might be referenced in an order.');
    }
  };

  const openModal = (type, item = null) => {
    setModalType(type);
    setActiveItem(item);
    setFormData({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalType('');
    setActiveItem(null);
    setFormData({});
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    
    if (modalType === 'add_flower') {
      const { data, error } = await supabase.from('flowers').insert([{ name: formData.name, price_per_stem: parseFloat(formData.price) }]).select();
      if (error) {
        console.error("Error adding flower:", error);
        alert("Failed to add flower: " + error.message);
        return;
      }
      if (data) setFlowers([...flowers, data[0]]);
    } 
    else if (modalType === 'add_flower_color') {
      const { data, error } = await supabase.from('flower_colors').insert([{ flower_id: activeItem.id, color_name: formData.name, hex_code: formData.hex, is_available: true }]).select();
      if (error) {
        console.error("Error adding flower color:", error);
        alert("Failed to add color: " + error.message);
        return;
      }
      if (data) setFlowerColors([...flowerColors, data[0]]);
    }
    else if (modalType === 'add_filler') {
      const { data, error } = await supabase.from('fillers').insert([{ name: formData.name, price: parseFloat(formData.price), is_available: true }]).select();
      if (error) {
        console.error("Error adding filler:", error);
        alert("Failed to add filler: " + error.message);
        return;
      }
      if (data) setFillers([...fillers, data[0]]);
    }
    else if (modalType === 'add_wrapper') {
      const { data, error } = await supabase.from('wrappers').insert([{ material: formData.name, price: parseFloat(formData.price) }]).select();
      if (error) {
        console.error("Error adding wrapper:", error);
        alert("Failed to add wrapper: " + error.message);
        return;
      }
      if (data) setWrappers([...wrappers, data[0]]);
    }
    else if (modalType === 'add_wrapper_color') {
      const { data, error } = await supabase.from('wrapper_colors').insert([{ wrapper_id: activeItem.id, color_name: formData.name, hex_code: formData.hex, is_available: true }]).select();
      if (error) {
        console.error("Error adding wrapper color:", error);
        alert("Failed to add wrapper color: " + error.message);
        return;
      }
      if (data) setWrapperColors([...wrapperColors, data[0]]);
    }

    closeModal();
  };

  return (
    <>
      <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-800">Inventory Management</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white px-2 pt-2 rounded-t-xl">
        <button 
          onClick={() => setActiveTab('flowers')}
          className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'flowers' ? 'border-astraea-pink text-astraea-pink' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
        >
          Flowers & Colors
        </button>
        <button 
          onClick={() => setActiveTab('fillers')}
          className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'fillers' ? 'border-astraea-pink text-astraea-pink' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
        >
          Fillers
        </button>
        <button 
          onClick={() => setActiveTab('wrappers')}
          className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'wrappers' ? 'border-astraea-pink text-astraea-pink' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
        >
          Wrappers
        </button>
      </div>

      <div className="bg-white rounded-b-xl shadow-sm border border-t-0 border-gray-200 p-6 min-h-[500px]">
        {loading ? (
          <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-astraea-pink border-t-transparent rounded-full animate-spin"></div></div>
        ) : (
          <>
            {/* FLOWERS TAB */}
            {activeTab === 'flowers' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold text-gray-800">Flower Types</h2>
                  <button onClick={() => openModal('add_flower')} className="flex items-center px-4 py-2 bg-astraea-pink text-white rounded-xl text-sm font-bold transition-all duration-200 hover:brightness-105 active:scale-95 hover:shadow-md hover:-translate-y-0.5">
                    <Plus className="w-4 h-4 mr-1" /> Add Flower
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-sm border-y border-gray-200">
                        <th className="px-6 py-3 font-medium">Name</th>
                        <th className="px-6 py-3 font-medium">Price/Stem</th>
                        <th className="px-6 py-3 font-medium">Colors (Click to toggle availability)</th>
                        <th className="px-6 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {flowers.map(f => (
                        <tr key={f.id}>
                          <td className="px-6 py-4 font-bold text-gray-800">{f.name}</td>
                          <td className="px-6 py-4 font-medium text-gray-600">₱{f.price_per_stem}</td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-2 items-center">
                              {flowerColors.filter(c => c.flower_id === f.id).map(c => (
                                <button
                                  key={c.id}
                                  onClick={() => handleToggleAvailability('flower_colors', c.id, c.is_available)}
                                  className={`relative w-8 h-8 rounded-full border shadow-sm transition-all hover:scale-110 ${c.is_available ? 'border-gray-300' : 'border-red-400 opacity-50'}`}
                                  style={{ backgroundColor: c.hex_code }}
                                  title={`${c.color_name} - ${c.is_available ? 'Available' : 'Out of Stock'}`}
                                >
                                  {!c.is_available && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                      <div className="w-full h-0.5 bg-red-600 transform rotate-45"></div>
                                    </div>
                                  )}
                                </button>
                              ))}
                              <button onClick={() => openModal('add_flower_color', f)} className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:text-astraea-pink hover:border-astraea-pink transition-colors">
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => handleDelete('flowers', f.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 ml-2">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* FILLERS TAB */}
            {activeTab === 'fillers' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold text-gray-800">Fillers</h2>
                  <button onClick={() => openModal('add_filler')} className="flex items-center px-4 py-2 bg-astraea-pink text-white rounded-xl text-sm font-bold transition-all duration-200 hover:brightness-105 active:scale-95 hover:shadow-md hover:-translate-y-0.5">
                    <Plus className="w-4 h-4 mr-1" /> Add Filler
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-sm border-y border-gray-200">
                        <th className="px-6 py-3 font-medium">Name</th>
                        <th className="px-6 py-3 font-medium">Price</th>
                        <th className="px-6 py-3 font-medium">Availability</th>
                        <th className="px-6 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {fillers.map(f => (
                        <tr key={f.id}>
                          <td className="px-6 py-4 font-bold text-gray-800">{f.name}</td>
                          <td className="px-6 py-4 font-medium text-gray-600">₱{f.price}</td>
                          <td className="px-6 py-4">
                            <button 
                              onClick={() => handleToggleAvailability('fillers', f.id, f.is_available)}
                              className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${f.is_available ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                            >
                              {f.is_available ? 'Available' : 'Out of Stock'}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => handleDelete('fillers', f.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 ml-2">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* WRAPPERS TAB */}
            {activeTab === 'wrappers' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold text-gray-800">Wrappers</h2>
                  <button onClick={() => openModal('add_wrapper')} className="flex items-center px-4 py-2 bg-astraea-pink text-white rounded-xl text-sm font-bold transition-all duration-200 hover:brightness-105 active:scale-95 hover:shadow-md hover:-translate-y-0.5">
                    <Plus className="w-4 h-4 mr-1" /> Add Wrapper
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-sm border-y border-gray-200">
                        <th className="px-6 py-3 font-medium">Material</th>
                        <th className="px-6 py-3 font-medium">Price</th>
                        <th className="px-6 py-3 font-medium">Colors (Click to toggle)</th>
                        <th className="px-6 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {wrappers.map(w => (
                        <tr key={w.id}>
                          <td className="px-6 py-4 font-bold text-gray-800">{w.material}</td>
                          <td className="px-6 py-4 font-medium text-gray-600">₱{w.price}</td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-2 items-center">
                              {wrapperColors.filter(c => c.wrapper_id === w.id).map(c => (
                                <button
                                  key={c.id}
                                  onClick={() => handleToggleAvailability('wrapper_colors', c.id, c.is_available)}
                                  className={`relative w-8 h-8 rounded-full border shadow-sm transition-all hover:scale-110 ${c.is_available ? 'border-gray-300' : 'border-red-400 opacity-50'}`}
                                  style={{ backgroundColor: c.hex_code }}
                                  title={`${c.color_name} - ${c.is_available ? 'Available' : 'Out of Stock'}`}
                                >
                                  {!c.is_available && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                      <div className="w-full h-0.5 bg-red-600 transform rotate-45"></div>
                                    </div>
                                  )}
                                </button>
                              ))}
                              <button onClick={() => openModal('add_wrapper_color', w)} className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:text-astraea-pink hover:border-astraea-pink transition-colors">
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => handleDelete('wrappers', w.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 ml-2">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>

      {/* Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md animate-fade-in shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-gray-800">
                {modalType === 'add_flower' && 'Add New Flower'}
                {modalType === 'add_flower_color' && `Add Color to ${activeItem.name}`}
                {modalType === 'add_filler' && 'Add New Filler'}
                {modalType === 'add_wrapper' && 'Add New Wrapper'}
                {modalType === 'add_wrapper_color' && `Add Color to ${activeItem.material}`}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleModalSubmit} className="space-y-4">
              {['add_flower', 'add_filler', 'add_wrapper', 'add_flower_color', 'add_wrapper_color'].includes(modalType) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {modalType.includes('color') ? 'Color Name' : modalType === 'add_wrapper' ? 'Material Name' : 'Name'}
                  </label>
                  <input 
                    type="text" 
                    required 
                    value={formData.name || ''} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-astraea-pink focus:border-astraea-pink outline-none" 
                  />
                </div>
              )}
              
              {['add_flower', 'add_filler', 'add_wrapper'].includes(modalType) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                  <input 
                    type="number" 
                    required 
                    min="0"
                    step="0.01"
                    value={formData.price || ''} 
                    onChange={e => setFormData({...formData, price: e.target.value})} 
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-astraea-pink focus:border-astraea-pink outline-none" 
                  />
                </div>
              )}

              {['add_flower_color', 'add_wrapper_color'].includes(modalType) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color Hex Code</label>
                  <div className="flex gap-2">
                    <input 
                      type="color" 
                      required 
                      value={formData.hex || '#000000'} 
                      onChange={e => setFormData({...formData, hex: e.target.value})} 
                      className="w-12 h-10 border border-gray-300 rounded-lg p-1 cursor-pointer" 
                    />
                    <input 
                      type="text" 
                      required 
                      value={formData.hex || '#000000'} 
                      onChange={e => setFormData({...formData, hex: e.target.value})} 
                      pattern="^#[0-9A-Fa-f]{6}$"
                      placeholder="#FFFFFF"
                      className="flex-grow border border-gray-300 rounded-lg p-2.5 focus:ring-astraea-pink focus:border-astraea-pink outline-none" 
                    />
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={closeModal} 
                  className="px-5 py-2.5 bg-[#FCFAFB] text-gray-700 border border-gray-200 rounded-xl font-bold transition-all duration-200 hover:bg-gray-100 hover:text-gray-800 active:scale-95 hover:shadow-sm hover:-translate-y-0.5"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2.5 bg-astraea-pink text-white rounded-xl font-bold transition-all duration-200 hover:brightness-105 active:scale-95 hover:shadow-md hover:-translate-y-0.5 text-lg"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminInventory;
