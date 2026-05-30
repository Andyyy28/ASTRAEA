import React, { useCallback, useEffect, useState } from 'react';
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

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);

    const today = new Date();
    today.setHours(0,0,0,0);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const { data: ordersData } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (ordersData) {
      const todayOrders = ordersData.filter(o => new Date(o.created_at) >= today).length;
      const pend = ordersData.filter(o => o.status === 'pending');
      const monthOrders = ordersData.filter(o => new Date(o.created_at) >= startOfMonth && o.status !== 'cancelled');
      const monthRev = ordersData
        .filter(o => new Date(o.created_at) >= startOfMonth && o.status !== 'cancelled')
        .reduce((sum, o) => sum + Number(o.total_amount), 0);

      let topBouquet = '-';
      const monthOrderIds = monthOrders.map(order => order.id);
      if (monthOrderIds.length > 0) {
        const { data: itemData } = await supabase
          .from('order_items')
          .select('bouquet_id, quantity, bouquets(name)')
          .in('order_id', monthOrderIds);

        const counts = new Map();
        itemData?.forEach(item => {
          const name = item.bouquets?.name || (item.bouquet_id ? 'Ready-Made Bouquet' : 'Custom Bouquet');
          counts.set(name, (counts.get(name) || 0) + (Number(item.quantity) || 1));
        });
        topBouquet = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
      }

      setPendingOrders(pend);

      setMetrics({
        ordersToday: todayOrders,
        pendingOrders: pend.length,
        revenueMonth: monthRev,
        topBouquet
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
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-dashboard-orders-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          window.setTimeout(fetchDashboardData, 150);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => {
          window.setTimeout(fetchDashboardData, 150);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDashboardData]);

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border border-astraea-pink/5 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl flex items-center justify-center shadow-inner">
            <ShoppingBag className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-400 mb-1">Orders Today</p>
            <h3 className="text-3xl font-extrabold text-astraea-darkgray">{metrics.ordersToday}</h3>
          </div>
        </div>
        
        <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border border-astraea-pink/5 flex flex-col sm:flex-row sm:items-center gap-3 relative">
          <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-2xl flex items-center justify-center shadow-inner">
            <Clock className="w-6 h-6 text-yellow-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-400 mb-1">Pending Orders</p>
            <h3 className="text-3xl font-extrabold text-astraea-darkgray">{metrics.pendingOrders}</h3>
          </div>
          {metrics.pendingOrders > 0 && (
            <span className="absolute top-6 right-6 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
            </span>
          )}
        </div>
        
        <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border border-astraea-pink/5 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-green-50 to-green-100 rounded-2xl flex items-center justify-center shadow-inner">
            <DollarSign className="w-6 h-6 text-green-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-400 mb-1">Revenue This Month</p>
            <h3 className="text-3xl font-extrabold text-astraea-darkgray">₱{metrics.revenueMonth.toLocaleString()}</h3>
          </div>
        </div>
        
        <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border border-astraea-pink/5 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl flex items-center justify-center shadow-inner">
            <TrendingUp className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-400 mb-1">Top Bouquet</p>
            <h3 className="text-base md:text-xl font-bold text-astraea-darkgray line-clamp-2" title={metrics.topBouquet}>{metrics.topBouquet}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Pending Orders Table */}
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-astraea-pink/5 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-white">
            <h2 className="font-extrabold text-xl text-astraea-darkgray">Pending Orders</h2>
            <Link to="/admin/orders" className="text-sm font-bold text-astraea-pink hover:text-astraea-pink/80 transition-colors">View All</Link>
          </div>
          <div className="overflow-x-auto flex-grow bg-white">
            {pendingOrders.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FCFAFB] text-gray-400 text-xs uppercase tracking-wider font-bold">
                    <th className="px-6 py-4 rounded-tl-xl">Order #</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Total</th>
                    <th className="px-6 py-4 rounded-tr-xl">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-sm">
                  {pendingOrders.map(order => (
                    <tr key={order.id} className="hover:bg-[#FCFAFB]/60 transition-colors duration-200">
                      <td className="px-6 py-5 font-bold text-astraea-pink">{order.reference_number}</td>
                      <td className="px-6 py-5 font-semibold text-gray-700">{order.customer_name}</td>
                      <td className="px-6 py-5 capitalize text-gray-500">{order.order_type}</td>
                      <td className="px-6 py-5 font-bold text-gray-700">?{Number(order.total_amount).toFixed(2)}</td>
                      <td className="px-6 py-5">
                      <Link to={`/admin/orders/${order.id}`} className="min-h-11 inline-flex items-center px-4 py-2 bg-[#FCFAFB] text-gray-600 rounded-xl font-bold hover:bg-gray-100 transition-colors border border-gray-100">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center h-full bg-white">
                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4 shadow-inner">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="font-extrabold text-xl text-gray-700">All caught up!</h3>
                <p className="text-gray-400 mt-2 font-medium">There are no pending orders.</p>
              </div>
            )}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white rounded-3xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-astraea-pink/5 flex flex-col">
          <div className="p-6 border-b border-gray-50 flex items-center">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center mr-3 shadow-inner">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <h2 className="font-extrabold text-xl text-astraea-darkgray">Low Stock</h2>
          </div>
          <div className="p-2 flex-grow overflow-y-auto max-h-[400px]">
            {lowStock.length > 0 ? (
              <ul className="divide-y divide-gray-50">
                {lowStock.map((item, idx) => (
                  <li key={`${item.table}-${item.id}-${idx}`} className="p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 hover:bg-[#FCFAFB] rounded-2xl transition-colors duration-200">
                    <span className="text-sm font-semibold text-gray-700">{item.name}</span>
                    <button 
                      onClick={() => handleMarkAvailable(item)}
                      className="min-h-11 px-4 py-2 bg-green-50 text-green-600 text-xs font-bold rounded-xl hover:bg-green-100 transition-colors"
                    >
                      Restocked
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center h-full">
                <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mb-4 shadow-inner">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                </div>
                <p className="text-base font-bold text-green-600">Inventory is healthy</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;

