import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2, X, Image as ImageIcon, Upload, Loader } from 'lucide-react';

// Upload image to Supabase Storage, returns the public URL
const uploadImage = async (file) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `bouquet-images/${fileName}`;

  const { error } = await supabase.storage.from('bouquets').upload(filePath, file);
  if (error) {
    console.error('Storage upload error:', error);
    return null;
  }

  const { data: urlData } = supabase.storage.from('bouquets').getPublicUrl(filePath);
  return urlData.publicUrl;
};

const AdminBouquets = () => {
  const [bouquets, setBouquets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imageFile, setImageFile] = useState(null); // Track the actual file for upload
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
    setImageFile(null);
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);
    
    try {
      // If user selected a file, upload it to Supabase Storage
      let imageUrls = formData.images.filter(i => i.trim() !== '');
      
      if (imageFile) {
        const publicUrl = await uploadImage(imageFile);
        if (publicUrl) {
          imageUrls = [publicUrl];
        } else {
          alert('Failed to upload image. Please try again or use an image URL instead.');
          setUploading(false);
          return;
        }
      }

      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        images: imageUrls
      };
      
      if (editingId) {
        const { data, error } = await supabase.from('bouquets').update(payload).eq('id', editingId).select();
        if (error) {
          console.error("Error updating bouquet:", error);
          alert("Failed to update bouquet: " + error.message);
          return;
        }
        if (data) {
          setBouquets(prev => prev.map(b => b.id === editingId ? data[0] : b));
        }
      } else {
        const { data, error } = await supabase.from('bouquets').insert([payload]).select();
        if (error) {
          console.error("Error inserting bouquet:", error);
          alert("Failed to create bouquet: " + error.message);
          return;
        }
        if (data) {
          setBouquets([data[0], ...bouquets]);
        }
      }
      setIsModalOpen(false);
      setImageFile(null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="space-y-6 animate-fade-in">
      
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Ready-Made Bouquets</h1>
        <button 
          onClick={() => openModal()} 
          className="flex items-center px-5 py-2.5 bg-astraea-pink text-white rounded-xl font-bold transition-all duration-200 hover:brightness-105 active:scale-95 hover:shadow-md hover:-translate-y-0.5"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Bouquet Image</label>
                
                {/* Drag and Drop / File Browser */}
                <div 
                  className="border-2 border-dashed border-gray-200 hover:border-astraea-pink rounded-xl p-6 text-center cursor-pointer transition-all duration-300 bg-gray-50 flex flex-col items-center justify-center min-h-[160px] hover:bg-astraea-blush/10"
                  onClick={() => document.getElementById('image-upload').click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file && file.type.startsWith('image/')) {
                      setImageFile(file);
                      setFormData({...formData, images: [URL.createObjectURL(file)]});
                    }
                  }}
                >
                  <input 
                    type="file" 
                    id="image-upload" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        setImageFile(file);
                        setFormData({...formData, images: [URL.createObjectURL(file)]});
                      }
                    }}
                  />
                  
                  {formData.images[0] ? (
                    <div className="relative group w-32 h-32 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                      <img src={formData.images[0]} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-semibold">
                        Change Image
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <ImageIcon className="w-8 h-8 text-gray-400 mx-auto" />
                      <p className="text-sm font-medium text-gray-600">Drag & drop or click to upload</p>
                      <p className="text-xs text-gray-400">Supports PNG, JPG, JPEG</p>
                    </div>
                  )}
                </div>

                <div className="relative flex py-3 items-center">
                  <div className="flex-grow border-t border-gray-200"></div>
                  <span className="flex-shrink mx-4 text-gray-400 text-xs uppercase font-semibold">or use image URL</span>
                  <div className="flex-grow border-t border-gray-200"></div>
                </div>

                <input 
                  type="url" 
                  value={imageFile ? '' : (formData.images[0] || '')} 
                  onChange={e => {
                    setImageFile(null); // Clear file if user types a URL instead
                    setFormData({...formData, images: [e.target.value]});
                  }} 
                  placeholder="https://example.com/image.jpg"
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-astraea-pink focus:border-astraea-pink outline-none" 
                />
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
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-5 py-2.5 bg-[#FCFAFB] text-gray-700 border border-gray-200 rounded-xl font-bold transition-all duration-200 hover:bg-gray-100 hover:text-gray-800 active:scale-95 hover:shadow-sm hover:-translate-y-0.5"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={uploading}
                  className="px-6 py-2.5 bg-astraea-pink text-white rounded-xl font-bold transition-all duration-200 hover:brightness-105 active:scale-95 hover:shadow-md hover:-translate-y-0.5 text-lg disabled:opacity-70 flex items-center gap-2"
                >
                  {uploading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : 'Save Bouquet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminBouquets;
