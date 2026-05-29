import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, User, Truck, Receipt, CheckCircle2, Clock } from 'lucide-react';

const AdminOrderDetail = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const fetchOrderDetails = async () => {
      setLoading(true);
      const { data: orderData } = await supabase.from('orders').select('*').eq('id', id).single();
      if (orderData) {
        setOrder(orderData);
        const { data: itemsData } = await supabase.from('order_items').select('*').eq('order_id', id);
        if (itemsData) setItems(itemsData);
      }
      setLoading(false);
    };

    fetchOrderDetails();
  }, [id]);

  const handleUpdateStatus = async (newStatus) => {
    setUpdating(true);
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', id);
    if (!error) {
      setOrder(prev => ({ ...prev, status: newStatus }));
    }
    setUpdating(false);
  };

  const handleTogglePaid = async () => {
    setUpdating(true);
    const { error } = await supabase.from('orders').update({ is_paid: !order.is_paid }).eq('id', id);
    if (!error) {
      setOrder(prev => ({ ...prev, is_paid: !prev.is_paid }));
    }
    setUpdating(false);
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-astraea-pink border-t-transparent rounded-full animate-spin"></div></div>;
  if (!order) return <div className="text-center py-20 text-gray-500">Order not found.</div>;

  const getStatusBadge = (status) => {
    switch(status) {
      case 'pending': return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-bold capitalize">Pending</span>;
      case 'being-made': return <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-bold capitalize">Being Made</span>;
      case 'ready': return <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-bold capitalize">Ready</span>;
      case 'completed': return <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-bold capitalize">Completed</span>;
      case 'cancelled': return <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-bold capitalize">Cancelled</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      
      <Link to="/admin/orders" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-astraea-pink transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Orders
      </Link>
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-200">
        <div>
          <div className="flex flex-wrap items-center gap-3 md:gap-4 mb-2">
            <h1 className="text-xl md:text-2xl font-bold text-gray-800 break-all">{order.reference_number}</h1>
            {getStatusBadge(order.status)}
            {order.is_paid ? (
              <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-sm font-bold flex items-center"><CheckCircle2 className="w-4 h-4 mr-1" /> Paid</span>
            ) : (
              <span className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-sm font-bold flex items-center"><Clock className="w-4 h-4 mr-1" /> Unpaid</span>
            )}
          </div>
          <p className="text-sm text-gray-500">Placed on {new Date(order.created_at).toLocaleString()}</p>
        </div>
        
        {/* Controls Panel */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-gray-50 p-2 rounded-lg border border-gray-100 w-full md:w-auto">
          <select 
            value={order.status}
            onChange={(e) => handleUpdateStatus(e.target.value)}
            disabled={updating}
            className="bg-white border border-gray-300 text-gray-700 text-sm rounded-md focus:ring-astraea-pink focus:border-astraea-pink block w-full p-2"
          >
            <option value="pending">Pending</option>
            <option value="being-made">Being Made</option>
            <option value="ready">Ready</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button
            onClick={handleTogglePaid}
            disabled={updating}
            className={`min-h-11 whitespace-nowrap px-4 py-2 text-sm font-bold rounded-md text-white transition-colors disabled:opacity-50 ${order.is_paid ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'}`}
          >
            Mark {order.is_paid ? 'Unpaid' : 'Paid'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Info Cards */}
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center"><User className="w-5 h-5 mr-2 text-astraea-pink" /> Customer Information</h3>
            <div className="space-y-3 text-sm">
              <div><span className="text-gray-500 block text-xs uppercase tracking-wider">Name</span><span className="font-medium">{order.customer_name}</span></div>
              <div><span className="text-gray-500 block text-xs uppercase tracking-wider">Contact</span><span className="font-medium">{order.contact_number}</span></div>
              <div><span className="text-gray-500 block text-xs uppercase tracking-wider">Email</span><span className="font-medium">{order.email}</span></div>
            </div>
          </div>
          
          {/* Logistics Info */}
          <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center"><Truck className="w-5 h-5 mr-2 text-astraea-pink" /> Delivery Information</h3>
            <div className="space-y-3 text-sm">
              <div><span className="text-gray-500 block text-xs uppercase tracking-wider">Method</span><span className="font-medium capitalize">{order.delivery_method}</span></div>
              
              {order.delivery_method === 'delivery' && (
                <div><span className="text-gray-500 block text-xs uppercase tracking-wider">Address</span><span className="font-medium">{order.delivery_address}</span></div>
              )}
              
              <div>
                <span className="text-gray-500 block text-xs uppercase tracking-wider">Preferred Date</span>
                <span className="font-medium">{order.preferred_date ? new Date(order.preferred_date).toLocaleDateString() : 'N/A'}</span>
              </div>
              
              {order.delivery_method === 'pickup' && (
                <div>
                  <span className="text-gray-500 block text-xs uppercase tracking-wider">Preferred Time</span>
                  <span className="font-medium">{order.preferred_time || 'N/A'}</span>
                </div>
              )}

              {order.special_notes && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <span className="text-gray-500 block text-xs uppercase tracking-wider mb-1">Special Notes</span>
                  <p className="font-medium bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-yellow-800">{order.special_notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Order Items */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col">
          <div className="p-6 border-b border-gray-200">
            <h3 className="font-bold text-gray-800 flex items-center"><Receipt className="w-5 h-5 mr-2 text-astraea-pink" /> Order Items</h3>
          </div>
          
          <div className="flex-grow p-6 space-y-6 overflow-y-auto">
            {items.map(item => (
              <div key={item.id} className="flex flex-col sm:flex-row gap-4 pb-6 border-b border-gray-100 last:border-0 last:pb-0">
                <div className="w-16 h-16 bg-astraea-blush rounded-xl flex-shrink-0 flex items-center justify-center text-astraea-pink font-bold">
                  {item.quantity}x
                </div>
                <div className="flex-grow">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-1">
                    <h4 className="font-bold text-gray-800">
                      {item.item_type === 'custom' ? 'Custom Bouquet' : 'Ready-Made Bouquet'}
                    </h4>
                    <span className="font-bold text-astraea-pink">₱{Number(item.subtotal).toFixed(2)}</span>
                  </div>
                  
                  {/* Detailed Breakdown for Custom Items */}
                  <div className="text-sm text-gray-600 mt-2 space-y-1 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    {item.size && <p><span className="font-medium text-gray-800">Size:</span> {item.size}</p>}
                    
                    {item.flowers && item.flowers.length > 0 && (
                      <div className="mt-1">
                        <span className="font-medium text-gray-800 block mb-1">Flowers:</span>
                        <ul className="list-disc pl-5">
                          {item.flowers.map((f, i) => <li key={i}>{f.quantity}x {f.name} {f.color ? `(${f.color})` : ''}</li>)}
                        </ul>
                      </div>
                    )}
                    
                    {item.fillers && item.fillers.length > 0 && (
                      <p><span className="font-medium text-gray-800">Fillers:</span> {item.fillers.join(', ')}</p>
                    )}
                    
                    {item.wrapper && (
                      <p><span className="font-medium text-gray-800">Wrapper:</span> {item.wrapper.material} {item.wrapper.color ? `(${item.wrapper.color})` : ''}</p>
                    )}
                    
                    {item.addons && (
                      <p><span className="font-medium text-gray-800">Add-ons:</span> {item.addons.ribbon && 'Ribbon, '} {item.addons.messageCard && 'Message Card'}</p>
                    )}

                    {item.message_card && (
                      <div className="mt-2 p-2 bg-white border border-gray-200 rounded text-gray-800 italic">
                        "{item.message_card}"
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="p-4 md:p-6 bg-gray-50 border-t border-gray-200 rounded-b-2xl">
            <div className="flex justify-between items-center text-lg">
              <span className="font-bold text-gray-800">Grand Total</span>
              <span className="font-bold text-2xl text-astraea-pink">₱{Number(order.total_amount).toFixed(2)}</span>
            </div>
            <p className="text-right text-sm text-gray-500 mt-1">(Includes delivery fee if applicable)</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminOrderDetail;
