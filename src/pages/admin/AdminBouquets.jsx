import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2, X, Image as ImageIcon } from 'lucide-react';

const AdminBouquets = () => {
  const [bouquets, setBouquets] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'Romantic',
    price: '',
    images: [''],
    is_visible: true,
    is_featured: false
  });
  
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchBouquets();
  }, []);

  const fetchBouquets = async () => {
    setLoading(true);
    const { data } = await supabase.from('bouquets').select('*').order('created_at', { ascending: false });
    if (data) setBouquets(data);
    setLoading(false);
  };

  const handleToggleVisibility = async (id, currentVal) => {
    const { error } = await supabase.from('bouquets').update({ is_visible: !currentVal }).eq('id', id);
    if (!error) {
      setBouquets(prev => prev.map(b => b.id === id ? { ...b, is_visible: !currentVal } : b));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this bouquet?')) return;
    const { error } = await supabase.from('bouquets').delete().eq('id', id);
    if (!error) {
      setBouquets(prev => prev.filter(b => b.id !== id));
    }
  };

  const openModal = (bouquet = null) => {
    if (bouquet) {
      setFormData({
        name: bouquet.name,
        description: bouquet.description,
        category: bouquet.category,
        price: bouquet.price,
        images: bouquet.images && bouquet.images.length > 0 ? bouquet.images : [''],
        is_visible: bouquet.is_visible,
        is_featured: bouquet.is_featured
      });
      setEditingId(bouquet.id);
    } else {
      setFormData({
        name: '',
        description: '',
        category: 'Romantic',
        price: '',
        images: [''],
        is_visible: true,
        is_featured: false
      });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      price: parseFloat(formData.price),
      images: formData.images.filter(i => i.trim() !== '')
    };
    
    if (editingId) {
      const { data, error } = await supabase.from('bouquets').update(payload).eq('id', editingId).select();
      if (!error && data) {
        setBouquets(prev => prev.map(b => b.id === editingId ? data[0] : b));
      }
    } else {
      const { data, error } = await supabase.from('bouquets').insert([payload]).select();
      if (!error && data) {
        setBouquets([data[0], ...bouquets]);
      }
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Ready-Made Bouquets</h1>
        <button 
          onClick={() => openModal()} 
          className="flex items-center px-4 py-2 bg-astraea-pink text-white rounded-lg font-bold hover:bg-astraea-pink/90 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5 mr-1" /> Add Bouquet
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm border-b border-gray-200">
                <th className="px-6 py-4 font-medium w-24">Photo</th>
                <th className="px-6 py-4 font-medium">Name & Category</th>
                <th className="px-6 py-4 font-medium">Price</th>
                <th className="px-6 py-4 font-medium text-center">Visibility</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr><td colSpan="5" className="text-center py-10"><div className="w-6 h-6 border-2 border-astraea-pink border-t-transparent rounded-full animate-spin mx-auto"></div></td></tr>
              ) : bouquets.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-10 text-gray-500">No bouquets found.</td></tr>
              ) : (
                bouquets.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
                        {b.images && b.images[0] ? (
                          <img src={b.images[0]} alt={b.name} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-gray-300" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-800 text-base mb-1">{b.name}</p>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">{b.category}</span>
                      {b.is_featured && <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">Featured</span>}
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-800">
                      ₱{Number(b.price).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => handleToggleVisibility(b.id, b.is_visible)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${b.is_visible ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                      >
                        {b.is_visible ? 'Visible' : 'Hidden'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <button onClick={() => openModal(b)} className="p-2 text-gray-500 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(b.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 ml-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl animate-fade-in shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
              <h3 className="font-bold text-xl text-gray-800">
                {editingId ? 'Edit Bouquet' : 'Add New Bouquet'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 p-2 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleModalSubmit} className="space-y-4 overflow-y-auto pr-2 flex-grow">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bouquet Name</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-astraea-pink focus:border-astraea-pink outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                  <input 
                    type="number" 
                    required 
                    min="0" step="0.01"
                    value={formData.price} 
                    onChange={e => setFormData({...formData, price: e.target.value})} 
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-astraea-pink focus:border-astraea-pink outline-none" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select 
                  value={formData.category} 
                  onChange={e => setFormData({...formData, category: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-astraea-pink focus:border-astraea-pink outline-none bg-white"
                >
                  <option>Romantic</option>
                  <option>Birthday</option>
                  <option>Graduation</option>
                  <option>Sympathy</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea 
                  rows="3"
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})} 
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-astraea-pink focus:border-astraea-pink outline-none resize-none" 
                ></textarea>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                <input 
                  type="url" 
                  value={formData.images[0] || ''} 
                  onChange={e => setFormData({...formData, images: [e.target.value]})} 
                  placeholder="https://example.com/image.jpg"
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-astraea-pink focus:border-astraea-pink outline-none mb-2" 
                />
                {formData.images[0] && (
                  <div className="w-32 h-32 rounded-xl overflow-hidden border border-gray-200 mt-2">
                    <img src={formData.images[0]} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              
              <div className="flex gap-6 pt-2">
                <label className="flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formData.is_visible}
                    onChange={e => setFormData({...formData, is_visible: e.target.checked})}
                    className="w-4 h-4 text-astraea-pink focus:ring-astraea-pink border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700 font-medium">Visible on Store</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formData.is_featured}
                    onChange={e => setFormData({...formData, is_featured: e.target.checked})}
                    className="w-4 h-4 text-astraea-pink focus:ring-astraea-pink border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700 font-medium">Featured (Homepage)</span>
                </label>
              </div>

              <div className="mt-8 pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition-colors">Cancel</button>
                <button type="submit" className="px-6 py-2.5 bg-astraea-pink text-white rounded-lg font-bold hover:bg-astraea-pink/90 transition-colors shadow-sm text-lg">Save Bouquet</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBouquets;
