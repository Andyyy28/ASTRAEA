import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatPrice } from '../../lib/formatPrice';
import { useNotifications } from '../../context/NotificationContext';
import { Image as ImageIcon, Minus, Plus, Trash2, X } from 'lucide-react';

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

const getBouquetStoragePath = (publicUrl) => {
  if (!publicUrl) return null;
  const marker = '/storage/v1/object/public/bouquets/';
  const markerIndex = publicUrl.indexOf(marker);
  if (markerIndex === -1) return null;
  return publicUrl.slice(markerIndex + marker.length).split('?')[0];
};

const emptyForms = {
  flower: { name: '', price: '', image_url: '', stock: 0, is_available: true },
  filler: { name: '', price: '', image_url: '', stock: 0, is_available: true },
  wrapper: { name: '', price: '', image_url: '', is_available: true },
  color: { name: '', hex: '#F9A8C9', is_available: true },
  size: { key: '', name: '', stems: '', base_price: '', display_order: 0, is_available: true },
  addon: { key: '', name: '', price: '', display_order: 0, is_available: true },
};

const tabs = [
  ['flowers', 'Flowers & Colors'],
  ['fillers', 'Fillers'],
  ['wrappers', 'Wrappers'],
  ['fuzzy', 'Fuzzy Wires'],
  ['sizes', 'Sizes'],
  ['addons', 'Add-ons'],
];

const tableHeadClass = 'px-4 py-3 font-medium';
const inputClass = 'w-full border border-gray-300 rounded-lg p-2.5 focus:ring-astraea-pink focus:border-astraea-pink outline-none';
const softBadge = 'px-3 py-1 rounded-full text-xs font-bold transition-colors';

const AdminInventory = () => {
  const [activeTab, setActiveTab] = useState('flowers');
  const [flowers, setFlowers] = useState([]);
  const [flowerColors, setFlowerColors] = useState([]);
  const [fillers, setFillers] = useState([]);
  const [wrappers, setWrappers] = useState([]);
  const [wrapperColors, setWrapperColors] = useState([]);
  const [fuzzyWireColors, setFuzzyWireColors] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [addons, setAddons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('');
  const [activeItem, setActiveItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const { showToast, showConfirm } = useNotifications();

  const orderedSizes = useMemo(() => [...sizes].sort((a, b) => (a.display_order || 0) - (b.display_order || 0)), [sizes]);
  const orderedAddons = useMemo(() => [...addons].sort((a, b) => (a.display_order || 0) - (b.display_order || 0)), [addons]);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
    const [fRes, fcRes, filRes, wRes, wcRes, fuzzyRes, sizeRes, addonRes] = await Promise.all([
      supabase.from('flowers').select('*').order('created_at', { ascending: false }),
      supabase.from('flower_colors').select('*'),
      supabase.from('fillers').select('*'),
      supabase.from('wrappers').select('*'),
      supabase.from('wrapper_colors').select('*'),
      supabase.from('fuzzy_wire_colors').select('*').order('display_order', { ascending: true }),
      supabase.from('bouquet_sizes').select('*').order('display_order', { ascending: true }),
      supabase.from('bouquet_addons').select('*').order('display_order', { ascending: true }),
    ]);

    if (fRes.data) setFlowers(fRes.data);
    if (fcRes.data) setFlowerColors(fcRes.data);
    if (filRes.data) setFillers(filRes.data);
    if (wRes.data) setWrappers(wRes.data);
    if (wcRes.data) setWrapperColors(wcRes.data);
    if (fuzzyRes.data) setFuzzyWireColors(fuzzyRes.data);
    if (sizeRes.data) setSizes(sizeRes.data);
    if (addonRes.data) setAddons(addonRes.data);
    setLoading(false);
  };

  const patchLocal = (table, updater) => {
    const setters = {
      flowers: setFlowers,
      flower_colors: setFlowerColors,
      fillers: setFillers,
      wrappers: setWrappers,
      wrapper_colors: setWrapperColors,
      fuzzy_wire_colors: setFuzzyWireColors,
      bouquet_sizes: setSizes,
      bouquet_addons: setAddons,
    };
    setters[table]?.(updater);
  };

  const handleToggleAvailability = async (table, id, currentValue) => {
    const { error } = await supabase.from(table).update({ is_available: !currentValue }).eq('id', id);
    if (error) {
      showToast({ type: 'error', title: 'Oops!', message: error.message });
      return;
    }
    patchLocal(table, prev => prev.map(item => item.id === id ? { ...item, is_available: !currentValue } : item));
  };

  const handleStockChange = async (table, id, currentStock, delta) => {
    const stock = Math.max(0, (Number(currentStock) || 0) + delta);
    const { error } = await supabase.from(table).update({ stock }).eq('id', id);
    if (error) {
      showToast({ type: 'error', title: 'Oops!', message: error.message });
      return;
    }
    patchLocal(table, prev => prev.map(item => item.id === id ? { ...item, stock } : item));
  };

  const handleDelete = async (table, id) => {
    const confirmed = await showConfirm({
      title: 'Delete item?',
      message: 'This action cannot be undone.',
      confirmText: 'Yes, delete',
      cancelText: 'Keep it',
    });
    if (!confirmed) return;

    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
      showToast({ type: 'error', title: 'Oops!', message: 'Error deleting item. It might be referenced in an order.' });
      return;
    }
    patchLocal(table, prev => prev.filter(item => item.id !== id));
  };

  const openModal = (type, item = null) => {
    const baseType = type.replace('edit_', '').replace('add_', '');
    const nextForm = item ? {
      key: item.key || '',
      name: item.name || item.material || item.color_name || '',
      price: item.price ?? '',
      base_price: item.base_price ?? '',
      stems: item.stems || '',
      image_url: item.image_url || '',
      stock: item.stock ?? 0,
      display_order: item.display_order ?? 0,
      hex: item.hex_code || '#F9A8C9',
      is_available: item.is_available !== false,
    } : { ...(emptyForms[baseType] || {}) };
    setModalType(type);
    setActiveItem(item);
    setFormData(nextForm);
    setImageFile(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalType('');
    setActiveItem(null);
    setFormData({});
    setImageFile(null);
  };

  const saveRow = async (table, payload, listSetter) => {
    const isEdit = modalType.startsWith('edit_');
    const query = isEdit
      ? supabase.from(table).update(payload).eq('id', activeItem.id).select()
      : supabase.from(table).insert([payload]).select();
    const { data, error } = await query;
    if (error) {
      showToast({ type: 'error', title: 'Oops!', message: error.message });
      return false;
    }
    if (data?.[0]) {
      listSetter(prev => isEdit ? prev.map(item => item.id === activeItem.id ? data[0] : item) : [...prev, data[0]]);
    }
    return true;
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);

    try {
      const stock = Math.max(0, parseInt(formData.stock, 10) || 0);
      const displayOrder = parseInt(formData.display_order, 10) || 0;
      let saved = false;
      let imageUrl = formData.image_url || null;
      const oldImageUrl = activeItem?.image_url || null;

      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      if (modalType.includes('flower') && !modalType.includes('color')) {
        saved = await saveRow('flowers', {
          name: formData.name,
          price_per_stem: parseFloat(formData.price) || 0,
          image_url: imageUrl,
          stock,
          is_available: formData.is_available !== false,
        }, setFlowers);
      } else if (modalType.includes('filler')) {
        saved = await saveRow('fillers', {
          name: formData.name,
          price: parseFloat(formData.price) || 0,
          image_url: imageUrl,
          stock,
          is_available: formData.is_available !== false,
        }, setFillers);
      } else if (modalType.includes('wrapper') && !modalType.includes('color')) {
        saved = await saveRow('wrappers', {
          material: formData.name,
          price: parseFloat(formData.price) || 0,
          image_url: imageUrl,
          is_available: formData.is_available !== false,
        }, setWrappers);
      } else if (modalType.includes('flower_color')) {
        saved = await saveRow('flower_colors', {
          flower_id: activeItem.flower_id || activeItem.id,
          color_name: formData.name,
          hex_code: formData.hex,
          is_available: formData.is_available !== false,
        }, setFlowerColors);
      } else if (modalType.includes('wrapper_color')) {
        saved = await saveRow('wrapper_colors', {
          wrapper_id: activeItem.wrapper_id || activeItem.id,
          color_name: formData.name,
          hex_code: formData.hex,
          is_available: formData.is_available !== false,
        }, setWrapperColors);
      } else if (modalType.includes('fuzzy')) {
        saved = await saveRow('fuzzy_wire_colors', {
          color_name: formData.name,
          hex_code: formData.hex,
          display_order: displayOrder,
          is_available: formData.is_available !== false,
        }, setFuzzyWireColors);
      } else if (modalType.includes('size')) {
        saved = await saveRow('bouquet_sizes', {
          key: formData.key,
          name: formData.name,
          stems: formData.stems || null,
          base_price: parseFloat(formData.base_price) || 0,
          display_order: displayOrder,
          is_available: formData.is_available !== false,
        }, setSizes);
      } else if (modalType.includes('addon')) {
        saved = await saveRow('bouquet_addons', {
          key: formData.key,
          name: formData.name,
          price: parseFloat(formData.price) || 0,
          display_order: displayOrder,
          is_available: formData.is_available !== false,
        }, setAddons);
      }

      if (saved) {
        const oldPath = imageFile ? getBouquetStoragePath(oldImageUrl) : null;
        if (oldPath) {
          await supabase.storage.from('bouquets').remove([oldPath]);
        }
        closeModal();
      }
    } catch (error) {
      console.error('Inventory save error:', error);
      showToast({
        type: 'error',
        title: 'Oops!',
        message: `Save failed: ${error.message || 'Unknown error'}`
      });
    } finally {
      setUploading(false);
    }
  };

  const availabilityButton = (table, item, disabledText = 'Unavailable') => (
    <button
      onClick={() => handleToggleAvailability(table, item.id, item.is_available)}
      className={`${softBadge} ${item.is_available ? 'bg-[#D5F0E8] text-[#2D7A5F] hover:bg-[#A8DFC9]' : 'bg-[#FDDDE6] text-[#C4658A] hover:bg-[#F4BFCF]'}`}
    >
      {item.is_available ? 'Available' : disabledText}
    </button>
  );

  const imagePreview = (item, label) => (
    <div className="h-12 w-12 overflow-hidden rounded-xl border border-astraea-rosegold/30 bg-astraea-blush/40 flex items-center justify-center text-[10px] text-astraea-pink/60">
      {item.image_url ? <img src={item.image_url} alt={label} className="h-full w-full object-cover" /> : 'Image'}
    </div>
  );

  const stockControls = (table, item) => (
    <div className="flex items-center gap-2">
      <button onClick={() => handleStockChange(table, item.id, item.stock, -1)} className="min-h-11 min-w-11 rounded-full border border-astraea-rosegold/40 text-astraea-pink hover:bg-astraea-blush/40"><Minus className="mx-auto h-4 w-4" /></button>
      <span className="inline-flex min-w-12 justify-center rounded-full bg-[#FDDDE6] px-3 py-1 text-xs font-bold text-[#C4658A]">{item.stock || 0}</span>
      <button onClick={() => handleStockChange(table, item.id, item.stock, 1)} className="min-h-11 min-w-11 rounded-full border border-astraea-rosegold/40 text-astraea-pink hover:bg-astraea-blush/40"><Plus className="mx-auto h-4 w-4" /></button>
    </div>
  );

  const colorChip = (table, item, onEdit) => (
    <button
      key={item.id}
      onClick={() => handleToggleAvailability(table, item.id, item.is_available)}
      onDoubleClick={onEdit}
      className={`relative min-w-11 min-h-11 w-11 h-11 md:w-8 md:h-8 rounded-full border shadow-sm transition-all hover:scale-110 ${item.is_available ? 'border-gray-300' : 'border-[#C4658A] opacity-50'}`}
      style={{ backgroundColor: item.hex_code }}
      title={`${item.color_name} - ${item.is_available ? 'Available' : 'Unavailable'} (double-click to edit)`}
    >
      {!item.is_available && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="w-full h-0.5 bg-[#C4658A] rotate-45"></div></div>}
    </button>
  );

  const actions = (editType, table, item) => (
    <div className="flex justify-end gap-1">
      <button onClick={() => openModal(editType, item)} className="px-3 py-2 text-xs font-bold text-astraea-pink rounded-lg hover:bg-astraea-blush/40">Edit</button>
      <button onClick={() => handleDelete(table, item.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
    </div>
  );

  return (
    <>
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl md:text-4xl font-bold text-gray-800">Inventory Management</h1>

        <div className="flex overflow-x-auto border-b border-gray-200 bg-white px-2 pt-2 rounded-t-xl">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`min-h-11 whitespace-nowrap px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === key ? 'border-astraea-pink text-astraea-pink' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-b-xl shadow-sm border border-t-0 border-gray-200 p-4 md:p-6 min-h-[500px]">
          {loading ? (
            <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-astraea-pink border-t-transparent rounded-full animate-spin"></div></div>
          ) : (
            <>
              {activeTab === 'flowers' && (
                <InventoryTable title="Flower Types" addText="Add Flower" onAdd={() => openModal('add_flower')} headers={['Image', 'Name', 'Price/Stem', 'Stock', 'Availability', 'Colors (click to toggle)', 'Actions']}>
                  {flowers.map(f => (
                    <tr key={f.id}>
                      <td className="px-4 py-4">{imagePreview(f, f.name)}</td>
                      <td className="px-4 py-4 font-bold text-gray-800">{f.name}</td>
                      <td className="px-4 py-4 font-medium text-gray-600">{formatPrice(f.price_per_stem)}</td>
                      <td className="px-4 py-4">{stockControls('flowers', f)}</td>
                      <td className="px-4 py-4">{f.stock <= 0 ? <span className={`${softBadge} bg-[#FDDDE6] text-[#C4658A]`}>Out of Stock</span> : availabilityButton('flowers', f)}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2 items-center">
                          {flowerColors.filter(c => c.flower_id === f.id).map(c => colorChip('flower_colors', c, () => openModal('edit_flower_color', c)))}
                          <button onClick={() => openModal('add_flower_color', f)} className="min-w-11 min-h-11 w-11 h-11 md:w-8 md:h-8 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:text-astraea-pink hover:border-astraea-pink transition-colors"><Plus className="w-4 h-4" /></button>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">{actions('edit_flower', 'flowers', f)}</td>
                    </tr>
                  ))}
                </InventoryTable>
              )}

              {activeTab === 'fillers' && (
                <InventoryTable title="Fillers" addText="Add Filler" onAdd={() => openModal('add_filler')} headers={['Image', 'Name', 'Price', 'Stock', 'Availability', 'Actions']}>
                  {fillers.map(f => (
                    <tr key={f.id}>
                      <td className="px-4 py-4">{imagePreview(f, f.name)}</td>
                      <td className="px-4 py-4 font-bold text-gray-800">{f.name}</td>
                      <td className="px-4 py-4 font-medium text-gray-600">{formatPrice(f.price)}</td>
                      <td className="px-4 py-4">{stockControls('fillers', f)}</td>
                      <td className="px-4 py-4">{f.stock <= 0 ? <span className={`${softBadge} bg-[#FDDDE6] text-[#C4658A]`}>Out of Stock</span> : availabilityButton('fillers', f)}</td>
                      <td className="px-4 py-4 text-right">{actions('edit_filler', 'fillers', f)}</td>
                    </tr>
                  ))}
                </InventoryTable>
              )}

              {activeTab === 'wrappers' && (
                <InventoryTable title="Wrappers" addText="Add Wrapper" onAdd={() => openModal('add_wrapper')} headers={['Image', 'Material', 'Price', 'Availability', 'Colors (click to toggle)', 'Actions']}>
                  {wrappers.map(w => (
                    <tr key={w.id}>
                      <td className="px-4 py-4">{imagePreview(w, w.material)}</td>
                      <td className="px-4 py-4 font-bold text-gray-800">{w.material}</td>
                      <td className="px-4 py-4 font-medium text-gray-600">{formatPrice(w.price)}</td>
                      <td className="px-4 py-4">{availabilityButton('wrappers', w)}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2 items-center">
                          {wrapperColors.filter(c => c.wrapper_id === w.id).map(c => colorChip('wrapper_colors', c, () => openModal('edit_wrapper_color', c)))}
                          <button onClick={() => openModal('add_wrapper_color', w)} className="min-w-11 min-h-11 w-11 h-11 md:w-8 md:h-8 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:text-astraea-pink hover:border-astraea-pink transition-colors"><Plus className="w-4 h-4" /></button>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">{actions('edit_wrapper', 'wrappers', w)}</td>
                    </tr>
                  ))}
                </InventoryTable>
              )}

              {activeTab === 'fuzzy' && (
                <InventoryTable title="Fuzzy Wire Colors" addText="Add Color" onAdd={() => openModal('add_fuzzy')} headers={['Color', 'Name', 'Order', 'Availability', 'Actions']}>
                  {fuzzyWireColors.map(c => (
                    <tr key={c.id}>
                      <td className="px-4 py-4">{colorChip('fuzzy_wire_colors', c, () => openModal('edit_fuzzy', c))}</td>
                      <td className="px-4 py-4 font-bold text-gray-800">{c.color_name}</td>
                      <td className="px-4 py-4 text-gray-600">{c.display_order || 0}</td>
                      <td className="px-4 py-4">{availabilityButton('fuzzy_wire_colors', c)}</td>
                      <td className="px-4 py-4 text-right">{actions('edit_fuzzy', 'fuzzy_wire_colors', c)}</td>
                    </tr>
                  ))}
                </InventoryTable>
              )}

              {activeTab === 'sizes' && (
                <InventoryTable title="Bouquet Sizes" addText="Add Size" onAdd={() => openModal('add_size')} headers={['Key', 'Name', 'Stems', 'Base Price', 'Order', 'Availability', 'Actions']}>
                  {orderedSizes.map(size => (
                    <tr key={size.id}>
                      <td className="px-4 py-4 font-mono text-xs text-gray-600">{size.key}</td>
                      <td className="px-4 py-4 font-bold text-gray-800">{size.name}</td>
                      <td className="px-4 py-4 text-gray-600">{size.stems}</td>
                      <td className="px-4 py-4 font-medium text-gray-600">{formatPrice(size.base_price)}</td>
                      <td className="px-4 py-4 text-gray-600">{size.display_order || 0}</td>
                      <td className="px-4 py-4">{availabilityButton('bouquet_sizes', size)}</td>
                      <td className="px-4 py-4 text-right">{actions('edit_size', 'bouquet_sizes', size)}</td>
                    </tr>
                  ))}
                </InventoryTable>
              )}

              {activeTab === 'addons' && (
                <InventoryTable title="Bouquet Add-ons" addText="Add Add-on" onAdd={() => openModal('add_addon')} headers={['Key', 'Name', 'Price', 'Order', 'Availability', 'Actions']}>
                  {orderedAddons.map(addon => (
                    <tr key={addon.id}>
                      <td className="px-4 py-4 font-mono text-xs text-gray-600">{addon.key}</td>
                      <td className="px-4 py-4 font-bold text-gray-800">{addon.name}</td>
                      <td className="px-4 py-4 font-medium text-gray-600">{formatPrice(addon.price)}</td>
                      <td className="px-4 py-4 text-gray-600">{addon.display_order || 0}</td>
                      <td className="px-4 py-4">{availabilityButton('bouquet_addons', addon)}</td>
                      <td className="px-4 py-4 text-right">{actions('edit_addon', 'bouquet_addons', addon)}</td>
                    </tr>
                  ))}
                </InventoryTable>
              )}
            </>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 w-full h-[92vh] sm:h-auto sm:max-w-md animate-fade-in shadow-xl overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-gray-800">{modalType.startsWith('edit_') ? 'Edit Item' : 'Add Item'}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleModalSubmit} className="space-y-4">
              {(modalType.includes('size') || modalType.includes('addon')) && (
                <Field label="Key"><input type="text" required value={formData.key || ''} onChange={e => setFormData({ ...formData, key: e.target.value })} className={inputClass} /></Field>
              )}
              {!modalType.includes('color') && !modalType.includes('fuzzy') && (
                <Field label={modalType.includes('wrapper') ? 'Material Name' : 'Name'}><input type="text" required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className={inputClass} /></Field>
              )}
              {(modalType.includes('color') || modalType.includes('fuzzy')) && (
                <>
                  <Field label="Color Name"><input type="text" required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className={inputClass} /></Field>
                  <Field label="Color Hex Code">
                    <div className="flex gap-2">
                      <input type="color" required value={formData.hex || '#F9A8C9'} onChange={e => setFormData({ ...formData, hex: e.target.value })} className="w-12 h-10 border border-gray-300 rounded-lg p-1 cursor-pointer" />
                      <input type="text" required value={formData.hex || '#F9A8C9'} onChange={e => setFormData({ ...formData, hex: e.target.value })} pattern="^#[0-9A-Fa-f]{6}$" className={`${inputClass} flex-grow`} />
                    </div>
                  </Field>
                </>
              )}
              {modalType.includes('size') && <Field label="Approx. Stems"><input type="text" value={formData.stems || ''} onChange={e => setFormData({ ...formData, stems: e.target.value })} className={inputClass} /></Field>}
              {((modalType.includes('flower') && !modalType.includes('color')) || modalType.includes('filler') || (modalType.includes('wrapper') && !modalType.includes('color')) || modalType.includes('addon')) ? (
                <Field label={modalType.includes('addon') ? 'Price' : modalType.includes('flower') ? 'Price Per Stem' : 'Price'}><input type="number" required min="0" step="0.01" value={formData.price || ''} onChange={e => setFormData({ ...formData, price: e.target.value })} className={inputClass} /></Field>
              ) : null}
              {modalType.includes('size') && <Field label="Base Price"><input type="number" required min="0" step="0.01" value={formData.base_price || ''} onChange={e => setFormData({ ...formData, base_price: e.target.value })} className={inputClass} /></Field>}
              {((modalType.includes('flower') && !modalType.includes('color')) || modalType.includes('filler') || (modalType.includes('wrapper') && !modalType.includes('color'))) ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
                  <div
                    className="border-2 border-dashed border-gray-200 hover:border-astraea-pink rounded-xl p-5 text-center cursor-pointer transition-all duration-300 bg-gray-50 flex flex-col items-center justify-center min-h-[150px] hover:bg-astraea-blush/10"
                    onClick={() => document.getElementById('inventory-image-upload').click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file && file.type.startsWith('image/')) {
                        setImageFile(file);
                        setFormData({ ...formData, image_url: URL.createObjectURL(file) });
                      }
                    }}
                  >
                    <input
                      type="file"
                      id="inventory-image-upload"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          setImageFile(file);
                          setFormData({ ...formData, image_url: URL.createObjectURL(file) });
                        }
                      }}
                    />
                    {formData.image_url ? (
                      <div className="relative group w-28 h-28 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                        <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" />
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
                    value={imageFile ? '' : (formData.image_url || '')}
                    onChange={e => {
                      setImageFile(null);
                      setFormData({ ...formData, image_url: e.target.value });
                    }}
                    placeholder="https://example.com/image.jpg"
                    className={inputClass}
                  />
                </div>
              ) : null}
              {(modalType.includes('flower') && !modalType.includes('color')) || modalType.includes('filler') ? (
                <Field label="Stock Count"><input type="number" min="0" step="1" value={formData.stock ?? 0} onChange={e => setFormData({ ...formData, stock: e.target.value })} className={inputClass} /></Field>
              ) : null}
              {(modalType.includes('size') || modalType.includes('addon') || modalType.includes('fuzzy')) && (
                <Field label="Display Order"><input type="number" step="1" value={formData.display_order ?? 0} onChange={e => setFormData({ ...formData, display_order: e.target.value })} className={inputClass} /></Field>
              )}
              <label className="flex items-center gap-3 rounded-xl border border-astraea-rosegold/20 p-3 text-sm font-bold text-gray-700">
                <input type="checkbox" checked={formData.is_available !== false} onChange={e => setFormData({ ...formData, is_available: e.target.checked })} className="w-5 h-5 accent-astraea-pink" />
                Available
              </label>
              <div className="mt-6 flex flex-col sm:flex-row sm:justify-end gap-3">
                <button type="button" onClick={closeModal} className="min-h-11 px-5 py-2.5 bg-[#FCFAFB] text-gray-700 border border-gray-200 rounded-xl font-bold transition-all duration-200 hover:bg-gray-100">Cancel</button>
                <button type="submit" disabled={uploading} className="min-h-11 px-6 py-2.5 bg-astraea-pink text-white rounded-xl font-bold transition-all duration-200 hover:brightness-105 hover:shadow-md disabled:opacity-70 flex items-center justify-center gap-2">
                  {uploading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

const InventoryTable = ({ title, addText, onAdd, headers, children }) => (
  <div>
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
      <h2 className="text-lg font-bold text-gray-800">{title}</h2>
      <button onClick={onAdd} className="min-h-11 flex items-center justify-center px-4 py-2 bg-astraea-pink text-white rounded-xl text-sm font-bold transition-all duration-200 hover:brightness-105 active:scale-95 hover:shadow-md hover:-translate-y-0.5">
        <Plus className="w-4 h-4 mr-1" /> {addText}
      </button>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-50 text-gray-500 text-sm border-y border-gray-200">
            {headers.map(header => <th key={header} className={`${tableHeadClass} ${header === 'Actions' ? 'text-right' : ''}`}>{header}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-sm">{children}</tbody>
      </table>
    </div>
  </div>
);

const Field = ({ label, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    {children}
  </div>
);

export default AdminInventory;
