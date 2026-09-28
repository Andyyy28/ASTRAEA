import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { formatPrice } from '../../lib/formatPrice';
import { useNotifications } from '../../context/NotificationContext';
import { Plus, Edit2, Trash2, X, Image as ImageIcon, Heart } from 'lucide-react';
import Skeleton from '../../components/Skeleton';

// Upload image to Supabase Storage, returns the public URL
const uploadImage = async (file) => {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    console.error('Auth session error:', sessionError);
    throw sessionError;
  }
  if (!session?.user) {
    throw new Error('You must be signed in with a real Supabase admin account before uploading images.');
  }

  const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;

  const { error } = await supabase.storage
    .from('bouquets')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });
  if (error) {
    console.log(error);
    throw error;
  }

  const { data: urlData } = supabase.storage.from('bouquets').getPublicUrl(fileName);
  return urlData.publicUrl;
};

const isMissingStockSchema = (error) => (
  error?.code === 'PGRST204'
  || error?.message?.toLowerCase().includes("'stock' column")
  || error?.message?.toLowerCase().includes('schema cache')
);

const omitStock = ({ stock, ...payload }) => payload;

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
    stock: 0,
    images: [''],
    is_visible: true,
    is_featured: false
  });
  
  const [editingId, setEditingId] = useState(null);
  const { showToast, showConfirm } = useNotifications();

  useEffect(() => {
    fetchBouquets();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('admin-bouquets-stock')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bouquets' },
        (payload) => {
          setBouquets(prev => {
            if (payload.eventType === 'DELETE') {
              return prev.filter(b => b.id !== payload.old?.id);
            }

            if (!payload.new?.id) return prev;
            const exists = prev.some(b => b.id === payload.new.id);
            return exists
              ? prev.map(b => b.id === payload.new.id ? { ...b, ...payload.new } : b)
              : [payload.new, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  const handleToggleFeatured = async (id, currentVal) => {
    if (!currentVal) {
      const featuredCount = bouquets.filter(b => b.is_featured && b.id !== id).length;
      if (featuredCount >= 3) {
        showToast({
          type: 'error',
          title: 'Oops! ✦',
          message: 'You can only mark up to 3 bouquets as best sellers.'
        });
        return;
      }
    }

    const { error } = await supabase.from('bouquets').update({ is_featured: !currentVal }).eq('id', id);
    if (!error) {
      setBouquets(prev => prev.map(b => b.id === id ? { ...b, is_featured: !currentVal } : b));
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await showConfirm({
      title: 'Delete bouquet? ✦',
      message: 'This will permanently remove this bouquet from your store.',
      confirmText: 'Yes, delete',
      cancelText: 'Keep it ♡'
    });
    if (!confirmed) return;
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
        stock: bouquet.stock || 0,
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
        stock: 0,
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
      let imageUrls = formData.images.filter(i => i.trim() !== '');
      
      if (imageFile) {
        const imageUrl = await uploadImage(imageFile);
        imageUrls = [imageUrl];
      }

      const featuredCount = bouquets.filter(b => b.is_featured && b.id !== editingId).length;
      if (formData.is_featured && featuredCount >= 3) {
        showToast({
          type: 'error',
          title: 'Oops! ✦',
          message: 'You can only mark up to 3 bouquets as best sellers.'
        });
        setUploading(false);
        return;
      }

      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        stock: Math.max(0, parseInt(formData.stock, 10) || 0),
        images: imageUrls
      };
      
      if (editingId) {
        let { data, error } = await supabase.from('bouquets').update(payload).eq('id', editingId).select();
        if (error) {
          console.error("Error updating bouquet:", error);
          if (isMissingStockSchema(error)) {
            const retry = await supabase.from('bouquets').update(omitStock(payload)).eq('id', editingId).select();
            data = retry.data;
            error = retry.error;
            if (!error) {
              showToast({
                type: 'info',
                title: 'Bouquet saved',
                message: 'Stock is not active yet. Run the stock migration in Supabase to enable stock counts.'
              });
            }
          }
          if (!error) {
            setBouquets(prev => prev.map(b => b.id === editingId ? { ...data[0], stock: payload.stock } : b));
            setIsModalOpen(false);
            setImageFile(null);
            return;
          }
          if (isMissingStockSchema(error)) {
            showToast({
              type: 'error',
              title: 'Stock setup needed',
              message: 'Run the bouquet stock migration in Supabase, then refresh this page.'
            });
            return;
          }
          showToast({ type: 'error', title: 'Oops! ✦', message: `Failed to update bouquet: ${error.message}` });
          return;
        }
        if (data) {
          setBouquets(prev => prev.map(b => b.id === editingId ? data[0] : b));
        }
      } else {
        let { data, error } = await supabase.from('bouquets').insert([payload]).select();
        if (error) {
          console.error("Error inserting bouquet:", error);
          if (isMissingStockSchema(error)) {
            const retry = await supabase.from('bouquets').insert([omitStock(payload)]).select();
            data = retry.data;
            error = retry.error;
            if (!error) {
              showToast({
                type: 'info',
                title: 'Bouquet saved',
                message: 'Stock is not active yet. Run the stock migration in Supabase to enable stock counts.'
              });
            }
          }
          if (!error) {
            setBouquets([{ ...data[0], stock: payload.stock }, ...bouquets]);
            setIsModalOpen(false);
            setImageFile(null);
            return;
          }
          if (isMissingStockSchema(error)) {
            showToast({
              type: 'error',
              title: 'Stock setup needed',
              message: 'Run the bouquet stock migration in Supabase, then refresh this page.'
            });
            return;
          }
          showToast({ type: 'error', title: 'Oops! ✦', message: `Failed to create bouquet: ${error.message}` });
          return;
        }
        if (data) {
          setBouquets([data[0], ...bouquets]);
        }
      }
      setIsModalOpen(false);
      setImageFile(null);
    } catch (error) {
      console.error('Bouquet save error:', error);
      showToast({
        type: 'error',
        title: 'Oops! ✦',
        message: `Save failed: ${error.message || 'Unknown error'}`
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="space-y-6 animate-fade-in fade-in-content">
      
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h1 className="text-2xl md:text-4xl font-bold text-gray-800">Ready-Made Bouquets</h1>
        <button 
          onClick={() => openModal()} 
          className="min-h-11 flex items-center justify-center px-5 py-2.5 bg-astraea-pink text-white rounded-xl font-bold transition-all duration-200 hover:brightness-105 active:scale-95 hover:shadow-md hover:-translate-y-0.5"
        >
          <Plus className="w-5 h-5 mr-1" /> Add Bouquet
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:hidden">
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden p-4 space-y-4">
              <Skeleton className="w-full aspect-[4/3] rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="w-2/3 h-5" />
                <Skeleton className="w-1/3 h-4" />
                <Skeleton className="w-1/4 h-5" />
              </div>
              <div className="flex justify-between items-center gap-2">
                <Skeleton className="w-16 h-8 rounded-full" />
                <div className="flex gap-2">
                  <Skeleton className="w-8 h-8 rounded-lg" />
                  <Skeleton className="w-8 h-8 rounded-lg" />
                  <Skeleton className="w-8 h-8 rounded-lg" />
                </div>
              </div>
            </div>
          ))
        ) : bouquets.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-gray-200 text-gray-500">No bouquets found.</div>
        ) : (
          bouquets.map(b => (
            <div key={b.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center">
                {b.images && b.images[0] ? (
                  <img src={b.images[0]} alt={b.name} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-gray-300" />
                )}
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <p className="font-bold text-gray-800 text-base">{b.name}</p>
                  <span className="inline-flex mt-1 px-2 py-0.5 bg-[#FDDDE6] text-[#C4658A] rounded text-xs font-medium">{b.stock || 0} in stock</span>
                  <p className="font-bold text-astraea-pink">{formatPrice(b.price)}</p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleToggleVisibility(b.id, b.is_visible)}
                    className={`min-h-11 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${b.is_visible ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    {b.is_visible ? 'Visible' : 'Hidden'}
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleFeatured(b.id, b.is_featured)}
                      className={`min-h-11 min-w-11 p-2 rounded-lg transition-colors ${b.is_featured ? 'text-rose-500 hover:text-rose-600 hover:bg-rose-50' : 'text-gray-400 hover:text-rose-500 hover:bg-rose-50'}`}
                      title={b.is_featured ? 'Remove from best sellers' : 'Mark as best seller'}
                      aria-label={b.is_featured ? 'Remove from best sellers' : 'Mark as best seller'}
                    >
                      <Heart className={`w-4 h-4 ${b.is_featured ? 'fill-current' : ''}`} />
                    </button>
                    <button onClick={() => openModal(b)} className="min-h-11 min-w-11 p-2 text-gray-500 hover:text-blue-600 rounded-lg hover:bg-blue-50">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(b.id)} className="min-h-11 min-w-11 p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm border-b border-gray-200">
                <th className="px-6 py-4 font-medium w-24">Photo</th>
                <th className="px-6 py-4 font-medium">Name & Category</th>
                <th className="px-6 py-4 font-medium">Price</th>
                <th className="px-6 py-4 font-medium text-center">Stock</th>
                <th className="px-6 py-4 font-medium text-center">Visibility</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i}>
                    <td className="px-6 py-4">
                      <Skeleton className="w-16 h-16 rounded-xl" />
                    </td>
                    <td className="px-6 py-4 space-y-2">
                      <Skeleton className="w-48 h-5" />
                      <Skeleton className="w-16 h-4" />
                    </td>
                    <td className="px-6 py-4">
                      <Skeleton className="w-20 h-5" />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Skeleton className="w-12 h-6 rounded-full mx-auto" />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Skeleton className="w-16 h-6 rounded-full mx-auto" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Skeleton className="w-8 h-8 rounded-lg" />
                        <Skeleton className="w-8 h-8 rounded-lg" />
                        <Skeleton className="w-8 h-8 rounded-lg" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : bouquets.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-10 text-gray-500">No bouquets found.</td></tr>
              ) : (
                bouquets.map(b => (
                  <tr key={b.id} className="border-b border-gray-100 hover:bg-[#FFFDFE] transition-colors">
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
                      {formatPrice(b.price)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#FDDDE6] text-[#C4658A]">{b.stock || 0}</span>
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
                      <button
                        onClick={() => handleToggleFeatured(b.id, b.is_featured)}
                        className={`p-2 transition-colors rounded-lg ${b.is_featured ? 'text-rose-500 hover:text-rose-600 hover:bg-rose-50' : 'text-gray-400 hover:text-rose-500 hover:bg-rose-50'}`}
                        title={b.is_featured ? 'Remove from best sellers' : 'Mark as best seller'}
                        aria-label={b.is_featured ? 'Remove from best sellers' : 'Mark as best seller'}
                      >
                        <Heart className={`w-4 h-4 ${b.is_featured ? 'fill-current' : ''}`} />
                      </button>
                      <button onClick={() => openModal(b)} className="p-2 text-gray-500 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50 ml-1">
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
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 w-full h-[94vh] sm:h-auto sm:max-w-2xl animate-fade-in shadow-xl sm:max-h-[90vh] flex flex-col">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="1"
                    value={formData.stock}
                    onChange={e => setFormData({...formData, stock: e.target.value})}
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
              
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 pt-2">
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
                    disabled={!formData.is_featured && bouquets.filter(b => b.is_featured && b.id !== editingId).length >= 3}
                    onChange={e => setFormData({...formData, is_featured: e.target.checked})}
                    className="w-4 h-4 text-astraea-pink focus:ring-astraea-pink border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700 font-medium">Featured (Homepage)</span>
                </label>
              </div>
              <div className="mt-8 pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="min-h-11 px-5 py-2.5 bg-[#FCFAFB] text-gray-700 border border-gray-200 rounded-xl font-bold transition-all duration-200 hover:bg-gray-100 hover:text-gray-800 active:scale-95 hover:shadow-sm hover:-translate-y-0.5"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={uploading}
                  className="min-h-11 px-6 py-2.5 bg-astraea-pink text-white rounded-xl font-bold transition-all duration-200 hover:brightness-105 active:scale-95 hover:shadow-md hover:-translate-y-0.5 text-lg disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <Skeleton className="w-24 h-5 bg-white/30" />
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
