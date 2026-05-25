import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ShoppingBag, Clock, DollarSign, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';

const AdminDashboard = () => {
  const [metrics, setMetrics] = useState({
    ordersToday: 0,
    pendingOrders: 0,
    revenueMonth: 0,
    topBouquet: '-'
  });
  const [pendingOrders, setPendingOrders] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    
    // In a real production app, these would be robust server-side queries or RPC functions.
    // For now, we do a basic client-side fetch.
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // 1. Fetch Orders (Pending & Revenue & Today)
    const { data: ordersData } = await supabase
      .from('orders')
      .select('*');

    if (ordersData) {
      const todayOrders = ordersData.filter(o => new Date(o.created_at) >= today).length;
      const pend = ordersData.filter(o => o.status === 'pending');
      const monthRev = ordersData
        .filter(o => new Date(o.created_at) >= startOfMonth && o.status !== 'cancelled')
        .reduce((sum, o) => sum + Number(o.total_amount), 0);
      
      setPendingOrders(pend);
      
      setMetrics({
        ordersToday: todayOrders,
        pendingOrders: pend.length,
        revenueMonth: monthRev,
        topBouquet: 'Sweet Blush Rose' // Hardcoded demo value for most ordered
      });
    }

    // 2. Fetch Low Stock
    const [fcRes, filRes, wcRes] = await Promise.all([
      supabase.from('flower_colors').select('id, color_name, flowers(name)').eq('is_available', false),
      supabase.from('fillers').select('id, name').eq('is_available', false),
      supabase.from('wrapper_colors').select('id, color_name, wrappers(material)').eq('is_available', false)
    ]);

    const outOfStock = [];
    if (fcRes.data) {
      fcRes.data.forEach(item => outOfStock.push({ id: item.id, table: 'flower_colors', name: `${item.flowers.name} (${item.color_name})` }));
    }
    if (filRes.data) {
      filRes.data.forEach(item => outOfStock.push({ id: item.id, table: 'fillers', name: item.name }));
    }
    if (wcRes.data) {
      wcRes.data.forEach(item => outOfStock.push({ id: item.id, table: 'wrapper_colors', name: `${item.wrappers.material} (${item.color_name})` }));
    }
    
    setLowStock(outOfStock);
    setLoading(false);
  };

  const handleMarkAvailable = async (item) => {
    await supabase.from(item.table).update({ is_available: true }).eq('id', item.id);
    setLowStock(prev => prev.filter(i => i.id !== item.id));
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-astraea-pink border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mr-4">
            <ShoppingBag className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Orders Today</p>
            <h3 className="text-2xl font-bold text-gray-800">{metrics.ordersToday}</h3>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center relative">
          <div className="w-12 h-12 bg-yellow-50 rounded-xl flex items-center justify-center mr-4">
            <Clock className="w-6 h-6 text-yellow-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Pending Orders</p>
            <h3 className="text-2xl font-bold text-gray-800">{metrics.pendingOrders}</h3>
          </div>
          {metrics.pendingOrders > 0 && (
            <span className="absolute top-4 right-4 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
            </span>
          )}
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center">
          <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center mr-4">
            <DollarSign className="w-6 h-6 text-green-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Revenue This Month</p>
            <h3 className="text-2xl font-bold text-gray-800">₱{metrics.revenueMonth.toLocaleString()}</h3>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center">
          <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center mr-4">
            <TrendingUp className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Top Bouquet</p>
            <h3 className="text-lg font-bold text-gray-800 truncate" title={metrics.topBouquet}>{metrics.topBouquet}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Pending Orders Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-bold text-lg text-gray-800">Pending Orders</h2>
            <Link to="/admin/orders" className="text-sm font-medium text-astraea-pink hover:underline">View All</Link>
          </div>
          <div className="overflow-x-auto flex-grow">
            {pendingOrders.length > 0 ? (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-sm">
                    <th className="px-6 py-3 font-medium">Order #</th>
                    <th className="px-6 py-3 font-medium">Customer</th>
                    <th className="px-6 py-3 font-medium">Type</th>
                    <th className="px-6 py-3 font-medium">Total</th>
                    <th className="px-6 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {pendingOrders.map(order => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-astraea-pink">{order.reference_number}</td>
                      <td className="px-6 py-4 text-gray-800">{order.customer_name}</td>
                      <td className="px-6 py-4 capitalize text-gray-600">{order.order_type}</td>
                      <td className="px-6 py-4 font-medium text-gray-800">₱{Number(order.total_amount).toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <Link to={`/admin/orders/${order.id}`} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md font-medium hover:bg-gray-200 transition-colors">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center h-full">
                <CheckCircle2 className="w-12 h-12 text-green-400 mb-4" />
                <h3 className="font-bold text-gray-800">All caught up!</h3>
                <p className="text-gray-500 mt-1">There are no pending orders.</p>
              </div>
            )}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <div className="p-6 border-b border-gray-100 flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
            <h2 className="font-bold text-lg text-gray-800">Low Stock Alerts</h2>
          </div>
          <div className="p-2 flex-grow overflow-y-auto max-h-[400px]">
            {lowStock.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {lowStock.map((item, idx) => (
                  <li key={`${item.table}-${item.id}-${idx}`} className="p-4 flex justify-between items-center hover:bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-800">{item.name}</span>
                    <button 
                      onClick={() => handleMarkAvailable(item)}
                      className="px-3 py-1 bg-green-50 text-green-600 text-xs font-bold rounded-md hover:bg-green-100 transition-colors"
                    >
                      Mark Available
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center h-full">
                <CheckCircle2 className="w-10 h-10 text-green-400 mb-3" />
                <p className="text-sm font-bold text-green-600">All items in stock</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;
