import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNotifications } from '../../context/NotificationContext';
import { Plus, Edit2, Trash2, X, Image as ImageIcon, Gift } from 'lucide-react';

const categories = [
  { value: 'keychain', label: 'Keychain' },
  { value: 'hair accessories', label: 'Hair Accessories' },
  { value: 'ornaments', label: 'Ornaments' },
  { value: 'other', label: 'Other' }
];

const categoryLabels = Object.fromEntries(categories.map(category => [category.value, category.label]));

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
    .from('other-products')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });
  if (error) {
    console.log(error);
    throw error;
  }

  const { data: urlData } = supabase.storage.from('other-products').getPublicUrl(fileName);
  return urlData.publicUrl;
};

const AdminOtherProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [imageItems, setImageItems] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: 'keychain',
    is_visible: true,
    is_available: true
  });
  const { showToast, showConfirm } = useNotifications();

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('admin-other-products-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'other_products' },
        (payload) => {
          setProducts(prev => {
            if (payload.eventType === 'DELETE') {
              return prev.filter(product => product.id !== payload.old?.id);
            }

            if (!payload.new?.id) return prev;
            const exists = prev.some(product => product.id === payload.new.id);
            return exists
              ? prev.map(product => product.id === payload.new.id ? { ...product, ...payload.new } : product)
              : [payload.new, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('other_products')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setProducts(data);
    setLoading(false);
  };

  const openModal = (product = null) => {
    imageItems.forEach(item => {
      if (item.preview?.startsWith('blob:')) URL.revokeObjectURL(item.preview);
    });

    if (product) {
      setFormData({
        name: product.name || '',
        description: product.description || '',
        price: product.price || '',
        category: product.category || 'keychain',
        is_visible: product.is_visible,
        is_available: product.is_available
      });
      setImageItems((product.images || []).map(url => ({ preview: url, existingUrl: url })));
      setEditingId(product.id);
    } else {
      setFormData({
        name: '',
        description: '',
        price: '',
        category: 'keychain',
        is_visible: true,
        is_available: true
      });
      setImageItems([]);
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setImageItems(prev => [
      ...prev,
      ...files.map(file => ({
        file,
        preview: URL.createObjectURL(file)
      }))
    ]);
    e.target.value = '';
  };

  const removeImage = (index) => {
    setImageItems(prev => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed?.preview?.startsWith('blob:')) URL.revokeObjectURL(removed.preview);
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const existingUrls = imageItems
        .filter(item => item.existingUrl)
        .map(item => item.existingUrl);
      const uploadedUrls = [];

      for (const item of imageItems.filter(item => item.file)) {
        uploadedUrls.push(await uploadImage(item.file));
      }

      const payload = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        category: formData.category,
        images: [...existingUrls, ...uploadedUrls],
        is_visible: formData.is_visible,
        is_available: formData.is_available
      };

      if (editingId) {
        const { data, error } = await supabase
          .from('other_products')
          .update(payload)
          .eq('id', editingId)
          .select();
        if (error) throw error;
        if (data) setProducts(prev => prev.map(product => product.id === editingId ? data[0] : product));
      } else {
        const { data, error } = await supabase
          .from('other_products')
          .insert([payload])
          .select();
        if (error) throw error;
        if (data) setProducts(prev => [data[0], ...prev]);
      }

      setIsModalOpen(false);
      setImageItems([]);
      showToast({
        type: 'success',
        title: 'Product saved',
        message: 'Your other product has been saved successfully.'
      });
    } catch (error) {
      console.error('Error saving product:', error);
      showToast({
        type: 'error',
        title: 'Oops! ✦',
        message: error.message || 'Failed to save product.'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await showConfirm({
      title: 'Delete this product? ✦',
      message: 'This will permanently remove it from your store.',
      confirmText: 'Yes, delete',
      cancelText: 'Keep it ♡'
    });
    if (!confirmed) return;

    const { error } = await supabase.from('other_products').delete().eq('id', id);
    if (!error) {
      setProducts(prev => prev.filter(product => product.id !== id));
    }
  };

  const visibilityBadge = (product) => (
    <span className={`px-3 py-1 rounded-full text-xs font-bold ${product.is_visible ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
      {product.is_visible ? 'Visible' : 'Hidden'}
    </span>
  );

  const availabilityBadge = (product) => (
    <span className={`px-3 py-1 rounded-full text-xs font-bold ${product.is_available ? 'bg-astraea-mint/40 text-[#2D7A5F]' : 'bg-[#FCE8EE] text-[#C4658A]'}`}>
      {product.is_available ? 'Available' : 'Out of Stock'}
    </span>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-astraea-darkgray">Other Products</h1>
          <p className="text-gray-500 mt-1">Manage keychains, accessories, ornaments, and more.</p>
        </div>
        <button onClick={() => openModal()} className="kawaii-btn-primary min-h-11 px-5 py-3">
          <Plus className="w-5 h-5 mr-2" /> Add New Product
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-astraea-pink border-t-transparent rounded-full animate-spin"></div></div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center border border-gray-200 text-gray-500">No other products found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {products.map(product => (
            <div key={product.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
              <div className="aspect-[4/3] bg-astraea-blush flex items-center justify-center overflow-hidden">
                {product.images?.[0] ? (
                  <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover object-top" />
                ) : (
                  <Gift className="w-14 h-14 text-astraea-pink/40" />
                )}
              </div>
              <div className="p-5 flex flex-col flex-grow">
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#E8D5F5] text-[#7B4FA8]">
                    {categoryLabels[product.category] || 'Other'}
                  </span>
                  {visibilityBadge(product)}
                  {availabilityBadge(product)}
                </div>
                <h3 className="font-bold text-lg text-astraea-darkgray line-clamp-1">{product.name}</h3>
                <p className="font-bold text-astraea-pink mt-1">₱{Number(product.price).toFixed(2)}</p>
                <div className="mt-auto pt-5 flex gap-2">
                  <button onClick={() => openModal(product)} className="kawaii-btn-outline flex-1 min-h-11 text-sm">
                    <Edit2 className="w-4 h-4 mr-1" /> Edit
                  </button>
                  <button onClick={() => handleDelete(product.id)} className="kawaii-btn-outline flex-1 min-h-11 text-sm text-red-500 border-red-200 hover:bg-red-50">
                    <Trash2 className="w-4 h-4 mr-1" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-astraea-darkgray">{editingId ? 'Edit Product' : 'Add New Product'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Photos</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  {imageItems.map((item, index) => (
                    <div key={`${item.preview}-${index}`} className="relative aspect-square rounded-xl overflow-hidden border-2 border-dashed border-astraea-pink/40 bg-astraea-blush">
                      <img src={item.preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover object-top" />
                      <button type="button" onClick={() => removeImage(index)} className="absolute top-1 right-1 w-7 h-7 rounded-full bg-white text-red-500 flex items-center justify-center shadow">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <label className="aspect-square rounded-xl border-2 border-dashed border-astraea-pink/40 bg-astraea-blush/40 flex flex-col items-center justify-center cursor-pointer text-astraea-pink">
                    <ImageIcon className="w-8 h-8 mb-2" />
                    <span className="text-xs font-bold">Add Photos</span>
                    <input type="file" multiple accept="image/*" onChange={handleImageChange} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                  <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-astraea-pink focus:border-transparent outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (₱)</label>
                  <input type="number" required min="0" step="0.01" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-astraea-pink focus:border-transparent outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea rows="4" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-astraea-pink focus:border-transparent outline-none resize-none"></textarea>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-astraea-pink focus:border-transparent outline-none">
                    {categories.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Availability</label>
                  <button type="button" onClick={() => setFormData({ ...formData, is_available: !formData.is_available })} className={`kawaii-btn w-full min-h-11 ${formData.is_available ? 'bg-astraea-mint/40 text-[#2D7A5F]' : 'bg-[#FCE8EE] text-[#C4658A]'}`}>
                    {formData.is_available ? 'Available' : 'Out of Stock'}
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
                  <button type="button" onClick={() => setFormData({ ...formData, is_visible: !formData.is_visible })} className={`kawaii-btn w-full min-h-11 ${formData.is_visible ? 'bg-white text-astraea-pink' : 'bg-gray-100 text-gray-500'}`}>
                    {formData.is_visible ? 'Show on store' : 'Hidden'}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="kawaii-btn-outline min-h-11 px-6">Cancel</button>
                <button type="submit" disabled={saving} className="kawaii-btn-primary min-h-11 px-6 disabled:opacity-70">
                  {saving ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOtherProducts;
