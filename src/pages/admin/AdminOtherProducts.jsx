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

const emptyForm = {
  name: '',
  description: '',
  price: '',
  stock: 0,
  category: 'keychain',
  is_visible: true,
  is_available: true
};

const uploadImage = async (file) => {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.user) {
    throw new Error('You must be signed in with a real Supabase admin account before uploading images.');
  }

  const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
  const { error } = await supabase.storage
    .from('other-products')
    .upload(fileName, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;

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
  const [stockDrafts, setStockDrafts] = useState({});
  const [formData, setFormData] = useState(emptyForm);
  const { showToast, showConfirm } = useNotifications();

  const inputClass = 'w-full rounded-xl border-2 border-[#F4BFCF] px-4 py-2.5 font-heading outline-none focus:border-[#F9A8C9] focus:ring-4 focus:ring-[#FDDDE6]';
  const labelClass = 'block text-sm font-medium text-[#C4658A] mb-1 font-heading';
  const toggleClass = (active, hiddenStyle = false) => `w-full min-h-11 rounded-full border-2 px-4 py-2 text-sm font-bold transition-colors ${active ? 'bg-[#D5F0E8] border-[#A8DFC9] text-[#2D7A5F]' : hiddenStyle ? 'bg-[#F1EFE8] border-[#D3D1C7] text-[#5F5E5A]' : 'bg-[#FDDDE6] border-[#F9A8C9] text-[#C4658A]'}`;

  const syncStockDrafts = (items) => {
    setStockDrafts(Object.fromEntries(items.map(product => [product.id, Number(product.stock) || 0])));
  };

  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('other_products')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) {
      setProducts(data);
      syncStockDrafts(data);
    }
    setLoading(false);
  };

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
            setStockDrafts(drafts => ({ ...drafts, [payload.new.id]: Number(payload.new.stock) || 0 }));
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

  const openModal = (product = null) => {
    imageItems.forEach(item => {
      if (item.preview?.startsWith('blob:')) URL.revokeObjectURL(item.preview);
    });

    if (product) {
      setFormData({
        name: product.name || '',
        description: product.description || '',
        price: product.price || '',
        stock: Number(product.stock) || 0,
        category: product.category || 'keychain',
        is_visible: product.is_visible,
        is_available: Number(product.stock) > 0
      });
      setImageItems((product.images || []).map(url => ({ preview: url, existingUrl: url })));
      setEditingId(product.id);
    } else {
      setFormData(emptyForm);
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
      ...files.map(file => ({ file, preview: URL.createObjectURL(file) }))
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
      const existingUrls = imageItems.filter(item => item.existingUrl).map(item => item.existingUrl);
      const uploadedUrls = [];

      for (const item of imageItems.filter(item => item.file)) {
        uploadedUrls.push(await uploadImage(item.file));
      }

      const stock = Math.max(0, Number(formData.stock) || 0);
      const payload = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        stock,
        category: formData.category,
        images: [...existingUrls, ...uploadedUrls],
        is_visible: formData.is_visible,
        is_available: stock > 0
      };

      if (editingId) {
        const { data, error } = await supabase
          .from('other_products')
          .update(payload)
          .eq('id', editingId)
          .select();
        if (error) throw error;
        if (data) {
          setProducts(prev => prev.map(product => product.id === editingId ? data[0] : product));
          setStockDrafts(prev => ({ ...prev, [editingId]: stock }));
        }
      } else {
        const { data, error } = await supabase
          .from('other_products')
          .insert([payload])
          .select();
        if (error) throw error;
        if (data) {
          setProducts(prev => [data[0], ...prev]);
          setStockDrafts(prev => ({ ...prev, [data[0].id]: stock }));
        }
      }

      setIsModalOpen(false);
      setImageItems([]);
      showToast({ type: 'success', title: 'Product saved', message: 'Your other product has been saved successfully.' });
    } catch (error) {
      console.error('Error saving product:', error);
      showToast({ type: 'error', title: 'Oops! ✦', message: error.message || 'Failed to save product.' });
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
      setStockDrafts(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const setStockDraft = (id, value) => {
    setStockDrafts(prev => ({ ...prev, [id]: Math.max(0, Number(value) || 0) }));
  };

  const updateProductStock = async (product) => {
    const stock = Math.max(0, Number(stockDrafts[product.id]) || 0);
    const { data, error } = await supabase
      .from('other_products')
      .update({ stock, is_available: stock > 0 })
      .eq('id', product.id)
      .select();

    if (error) {
      showToast({ type: 'error', title: 'Oops! ✦', message: error.message || 'Failed to update stock.' });
      return;
    }

    if (data?.[0]) setProducts(prev => prev.map(item => item.id === product.id ? data[0] : item));
    showToast({ type: 'success', title: 'Stock updated! ✿', message: 'Product stock has been saved.' });
  };

  const visibilityBadge = (product) => (
    <span className={`px-2 py-0.5 rounded-full text-xs font-heading border ${product.is_visible ? 'bg-[#D5F0E8] border-[#A8DFC9] text-[#2D7A5F]' : 'bg-[#F1EFE8] border-[#D3D1C7] text-[#5F5E5A]'}`}>
      {product.is_visible ? 'Visible' : 'Hidden'}
    </span>
  );

  const availabilityBadge = (product) => (
    <span className={`px-2 py-0.5 rounded-full text-xs font-heading border ${product.is_available ? 'bg-[#D5F0E8] border-[#A8DFC9] text-[#2D7A5F]' : 'bg-[#FDDDE6] border-[#F9A8C9] text-[#C4658A]'}`}>
      {product.is_available ? 'Available' : 'Out of Stock'}
    </span>
  );

  const stockBadge = (stockValue) => {
    const stock = Number(stockValue) || 0;
    if (stock > 10) {
      return <span className="inline-flex w-fit rounded-full border border-[#A8DFC9] bg-[#D5F0E8] px-2 py-0.5 text-xs font-bold text-[#2D7A5F]">✿ In Stock ({stock} left)</span>;
    }
    if (stock > 0) {
      return <span className="inline-flex w-fit rounded-full border border-[#F9C74F] bg-[#FFF3CC] px-2 py-0.5 text-xs font-bold text-[#8B6914]">⚠ Low Stock ({stock} left)</span>;
    }
    return <span className="inline-flex w-fit rounded-full border border-[#F9A8C9] bg-[#FDDDE6] px-2 py-0.5 text-xs font-bold text-[#C4658A]">✦ Out of Stock</span>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-heading text-[#3D2C35]">✿ Other Products</h1>
          <p className="text-sm font-heading text-[#6B5560] mt-1">Manage keychains, accessories and more ♡</p>
        </div>
        <button onClick={() => openModal()} className="kawaii-btn-primary min-h-11 px-5 py-3 rounded-full">
          <Plus className="w-5 h-5 mr-2" /> Add New Product
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-astraea-pink border-t-transparent rounded-full animate-spin"></div></div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center border border-gray-200 text-gray-500">No other products found.</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(product => (
            <div key={product.id} className="bg-white border-2 border-dashed border-[#F4BFCF] rounded-[20px] shadow-[4px_4px_0px_#F9A8C9] overflow-hidden flex flex-col">
              <div className="aspect-[3/4] bg-astraea-blush flex items-center justify-center overflow-hidden">
                {product.images?.[0] ? (
                  <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover object-top" />
                ) : (
                  <Gift className="w-14 h-14 text-astraea-pink/40" />
                )}
              </div>
              <div className="p-3 flex flex-col flex-grow">
                <h3 className="font-heading font-bold text-sm text-[#3D2C35] line-clamp-1">{product.name}</h3>
                <p className="inline-block w-fit px-2 py-0.5 mt-2 rounded-lg bg-[#FFF3CC] border-2 border-[#F9C74F] font-accent text-lg leading-tight text-[#8B6914]">₱{Number(product.price).toFixed(2)}</p>
                <div className="mt-2">{stockBadge(product.stock)}</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  <span className="px-2 py-0.5 rounded-full text-xs font-heading border bg-[#E8D5F5] border-[#C9A8E8] text-[#7B4FA8]">
                    {categoryLabels[product.category] || 'Other'}
                  </span>
                  {visibilityBadge(product)}
                  {availabilityBadge(product)}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1">
                  <button type="button" onClick={() => setStockDraft(product.id, (stockDrafts[product.id] ?? product.stock ?? 0) - 1)} className="min-h-8 min-w-8 rounded-full border-2 border-[#F4BFCF] bg-white text-[#C4658A] font-bold">-</button>
                  <input type="number" min="0" value={stockDrafts[product.id] ?? (Number(product.stock) || 0)} onChange={e => setStockDraft(product.id, e.target.value)} className="h-8 w-14 rounded-lg border-2 border-[#F4BFCF] text-center text-sm font-bold outline-none focus:border-[#F9A8C9]" />
                  <button type="button" onClick={() => setStockDraft(product.id, (stockDrafts[product.id] ?? product.stock ?? 0) + 1)} className="min-h-8 min-w-8 rounded-full border-2 border-[#F4BFCF] bg-white text-[#C4658A] font-bold">+</button>
                  <button type="button" onClick={() => updateProductStock(product)} className="min-h-8 rounded-full bg-[#F9A8C9] px-3 text-xs font-bold text-white shadow-[2px_2px_0px_#E891B8]">Update</button>
                </div>
                <div className="mt-auto pt-4 flex gap-2">
                  <button onClick={() => openModal(product)} className="kawaii-btn-outline flex-1 min-h-10 text-xs text-[#C4658A] rounded-full">
                    <Edit2 className="w-4 h-4 mr-1" /> Edit
                  </button>
                  <button onClick={() => handleDelete(product.id)} className="kawaii-btn-outline flex-1 min-h-10 text-xs text-[#C4658A] border-[#F4BFCF] hover:bg-[#FFF5F7] rounded-full">
                    <Trash2 className="w-4 h-4 mr-1" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-[rgba(61,44,53,0.45)] z-[60] flex items-center justify-center p-4">
          <div className="bg-white border-2 border-dashed border-[#F4BFCF] rounded-[24px] shadow-[6px_6px_0px_#F9A8C9] w-[600px] max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto p-6">
            <div className="h-2 bg-[#F9A8C9] rounded mb-4"></div>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold font-heading text-[#3D2C35]">✿ {editingId ? 'Edit Product' : 'Add New Product'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="kawaii-btn-outline min-h-9 px-3 rounded-full text-[#C4658A]"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className={labelClass}>✿ Product Photos</label>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {imageItems.map((item, index) => (
                    <div key={`${item.preview}-${index}`} className="relative aspect-square rounded-xl overflow-hidden border-2 border-[#F4BFCF] bg-astraea-blush">
                      <img src={item.preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover object-top" />
                      <button type="button" onClick={() => removeImage(index)} className="absolute top-1 right-1 w-7 h-7 rounded-full bg-[#F9A8C9] text-white flex items-center justify-center shadow">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <label className="aspect-square rounded-xl border-2 border-dashed border-[#F4BFCF] bg-[#FFF5F7] flex flex-col items-center justify-center cursor-pointer text-[#C4658A]">
                    <ImageIcon className="w-6 h-6 mb-2 text-[#F9A8C9]" />
                    <span className="text-sm font-heading">Add Photos</span>
                    <input type="file" multiple accept="image/*" onChange={handleImageChange} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className={labelClass}>Product Name</label>
                  <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Price ₱</label>
                  <input type="number" required min="0" step="0.01" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Stock Quantity</label>
                  <input type="number" min="0" placeholder="0" value={formData.stock} onChange={e => setFormData({ ...formData, stock: Math.max(0, Number(e.target.value) || 0), is_available: Number(e.target.value) > 0 })} className={inputClass} />
                  <p className="mt-1 text-xs font-heading text-[#6B5560]">Set to 0 if out of stock</p>
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Description</label>
                  <textarea rows="4" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className={`${inputClass} min-h-[100px] resize-none`}></textarea>
                </div>
                <div>
                  <label className={labelClass}>Category</label>
                  <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className={inputClass}>
                    {categories.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Availability</label>
                  <button type="button" onClick={() => setFormData({ ...formData, stock: formData.is_available ? 0 : Math.max(1, Number(formData.stock) || 1), is_available: !formData.is_available })} className={toggleClass(formData.is_available)}>
                    {formData.is_available ? 'Available' : 'Out of Stock'}
                  </button>
                </div>
                <div>
                  <label className={labelClass}>Visibility</label>
                  <button type="button" onClick={() => setFormData({ ...formData, is_visible: !formData.is_visible })} className={toggleClass(formData.is_visible, true)}>
                    {formData.is_visible ? 'Visible' : 'Hidden'}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t-2 border-dashed border-[#F4BFCF]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="kawaii-btn-outline min-h-11 px-6 rounded-full">Cancel</button>
                <button type="submit" disabled={saving} className="kawaii-btn-primary min-h-11 px-6 rounded-full disabled:opacity-70">
                  {saving ? 'Saving...' : '♡ Save Product'}
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
