import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatPrice } from '../../lib/formatPrice';
import { useNotifications } from '../../context/NotificationContext';
import { Search, Filter, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import Skeleton from '../../components/Skeleton';

const statusOptions = ['pending', 'confirmed', 'being-made', 'ready', 'completed', 'cancelled'];
const formatDelivery = (method) => method === 'pickup' ? 'Store Pickup' : 'Delivery';

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const { showToast } = useNotifications();
  
  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('admin-orders-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          setOrders(prev => {
            if (payload.eventType === 'DELETE') {
              return prev.filter(order => order.id !== payload.old?.id);
            }
            if (!payload.new?.id) return prev;
            const exists = prev.some(order => order.id === payload.new.id);
            return exists
              ? prev.map(order => order.id === payload.new.id ? { ...order, ...payload.new } : order)
              : [payload.new, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (data) setOrders(data);
    setLoading(false);
  };

  const handleStatusChange = async (order, status) => {
    if (status === order.status) return;
    setUpdatingId(order.id);
    const { data, error } = await supabase.rpc('update_order_status', {
      p_order_id: order.id,
      p_status: status
    });
    if (error) {
      showToast({ type: 'error', title: 'Oops!', message: error.message || 'Could not update order status.' });
    } else if (data) {
      setOrders(prev => prev.map(item => item.id === order.id ? data : item));
    }
    setUpdatingId(null);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Derived state
  let filteredOrders = [...orders];

  if (search) {
    filteredOrders = filteredOrders.filter(o => 
      o.customer_name.toLowerCase().includes(search.toLowerCase()) || 
      o.reference_number.toLowerCase().includes(search.toLowerCase())
    );
  }

  if (statusFilter !== 'All') {
    filteredOrders = filteredOrders.filter(o => o.status.toLowerCase() === statusFilter.toLowerCase());
  }

  if (typeFilter !== 'All Types') {
    const typeVal = typeFilter === 'Ready-Made' ? 'ready-made' : 'custom';
    filteredOrders = filteredOrders.filter(o => o.order_type === typeVal);
  }

  if (dateFrom) {
    filteredOrders = filteredOrders.filter(o => new Date(o.created_at) >= new Date(dateFrom));
  }
  if (dateTo) {
    // Add 1 day to include the whole "To" day
    const toDate = new Date(dateTo);
    toDate.setDate(toDate.getDate() + 1);
    filteredOrders = filteredOrders.filter(o => new Date(o.created_at) < toDate);
  }

  // Sorting
  filteredOrders.sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
    if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const currentOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getStatusBadge = (status) => {
    switch(status) {
      case 'pending': return <span className="px-2.5 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-bold capitalize">Pending</span>;
      case 'confirmed': return <span className="px-2.5 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-bold capitalize">Confirmed</span>;
      case 'being-made': return <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold capitalize">Being Made</span>;
      case 'ready': return <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold capitalize">Ready</span>;
      case 'ready': return <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold capitalize">Ready</span>;
      case 'completed': return <span className="px-2.5 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-bold capitalize">Completed</span>;
      case 'cancelled': return <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold capitalize">Cancelled</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in fade-in-content">
      <h1 className="text-2xl md:text-3xl font-extrabold text-astraea-darkgray tracking-tight">Orders Management</h1>
      
      {/* Filters Bar */}
      <div className="bg-white p-4 md:p-6 rounded-3xl shadow-sm border border-astraea-pink/5 space-y-5">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search by customer name or reference..." 
              value={search}
              onChange={(e) => {setSearch(e.target.value); setCurrentPage(1);}}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-astraea-pink"
            />
          </div>
          <select 
            value={statusFilter}
            onChange={(e) => {setStatusFilter(e.target.value); setCurrentPage(1);}}
            className="w-full md:w-auto border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-astraea-pink"
          >
            <option>All</option>
            <option>Pending</option>
            <option>Confirmed</option>
            <option>Being-Made</option>
            <option>Ready</option>
            <option>Completed</option>
            <option>Cancelled</option>
          </select>
          <select 
            value={typeFilter}
            onChange={(e) => {setTypeFilter(e.target.value); setCurrentPage(1);}}
            className="w-full md:w-auto border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-astraea-pink"
          >
            <option>All Types</option>
            <option>Ready-Made</option>
            <option>Custom</option>
          </select>
        </div>
        <div className="flex flex-col md:flex-row gap-4 md:items-center">
          <span className="text-sm font-medium text-gray-600 flex items-center"><Filter className="w-4 h-4 mr-2" /> Date Range:</span>
          <input 
            type="date" 
            value={dateFrom}
            onChange={(e) => {setDateFrom(e.target.value); setCurrentPage(1);}}
            className="w-full md:w-auto border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-astraea-pink"
          />
          <span className="text-gray-400 hidden md:inline">to</span>
          <input 
            type="date" 
            value={dateTo}
            onChange={(e) => {setDateTo(e.target.value); setCurrentPage(1);}}
            className="w-full md:w-auto border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-astraea-pink"
          />
          <button 
            onClick={() => {
              setSearch(''); setStatusFilter('All'); setTypeFilter('All Types'); setDateFrom(''); setDateTo(''); setCurrentPage(1);
            }}
            className="min-h-11 text-sm text-astraea-pink hover:underline font-medium md:ml-auto"
          >
            Clear Filters
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:hidden">
        {loading ? (
          [1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-astraea-pink/5 shadow-sm space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-grow">
                  <Skeleton className="w-1/3 h-5" />
                  <Skeleton className="w-1/2 h-4" />
                </div>
                <Skeleton className="w-20 h-6 rounded-full" />
              </div>
              <div className="flex justify-between text-sm">
                <Skeleton className="w-16 h-4" />
                <Skeleton className="w-16 h-5" />
              </div>
              <Skeleton className="w-full h-10 rounded-xl" />
            </div>
          ))
        ) : currentOrders.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-astraea-pink/5 text-gray-500">No orders found.</div>
        ) : (
          currentOrders.map(order => (
            <div key={order.id} className="bg-white rounded-2xl p-4 border border-astraea-pink/5 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-astraea-pink break-all">{order.reference_number}</p>
                  <p className="text-sm font-semibold text-gray-700">{order.customer_name}</p>
                </div>
                {getStatusBadge(order.status)}
              </div>
              <div className="flex justify-between text-sm">
                <span className="capitalize text-gray-500">{order.order_type}</span>
                <span className="font-bold">{formatPrice(order.total_amount)}</span>
              </div>
              <Link to={`/admin/orders/${order.id}`} className="min-h-11 flex items-center justify-center w-full px-4 py-2 bg-[#FCFAFB] text-gray-600 rounded-xl font-bold hover:bg-gray-100 transition-colors border border-gray-100">
                View
              </Link>
            </div>
          ))
        )}
      </div>

      {/* Table */}
      <div className="hidden md:flex bg-white rounded-3xl shadow-sm border border-astraea-pink/5 overflow-hidden flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap border-collapse">
            <thead>
              <tr className="bg-[#FCFAFB] border-b border-gray-50 text-xs uppercase tracking-wider font-bold text-gray-400">
                <th className="px-6 py-4 font-medium">Reference #</th>
                <th className="px-6 py-4 font-medium">Customer Name</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium">Delivery</th>
                <th className="px-6 py-5 cursor-pointer hover:text-gray-600 transition-colors" onClick={() => handleSort('total_amount')}>
                  <div className="flex items-center">Total <ArrowUpDown className="w-4 h-4 ml-1" /></div>
                </th>
                <th className="px-6 py-5 cursor-pointer hover:text-gray-600 transition-colors" onClick={() => handleSort('created_at')}>
                  <div className="flex items-center">Date <ArrowUpDown className="w-4 h-4 ml-1" /></div>
                </th>
                <th className="px-6 py-5">Status</th>
                <th className="px-6 py-5">Paid</th>
                <th className="px-6 py-5 text-right rounded-tr-xl">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {loading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i}>
                    <td className="px-6 py-5"><Skeleton className="w-24 h-5" /></td>
                    <td className="px-6 py-5"><Skeleton className="w-32 h-5" /></td>
                    <td className="px-6 py-5"><Skeleton className="w-16 h-5" /></td>
                    <td className="px-6 py-5"><Skeleton className="w-20 h-5" /></td>
                    <td className="px-6 py-5"><Skeleton className="w-16 h-5" /></td>
                    <td className="px-6 py-5"><Skeleton className="w-20 h-5" /></td>
                    <td className="px-6 py-5"><Skeleton className="w-16 h-6 rounded-full" /></td>
                    <td className="px-6 py-5"><Skeleton className="w-12 h-6 rounded-lg" /></td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Skeleton className="w-28 h-9 rounded-xl" />
                        <Skeleton className="w-12 h-9 rounded-xl" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : currentOrders.length === 0 ? (
                <tr><td colSpan="9" className="text-center py-10 text-gray-500">No orders found.</td></tr>
              ) : (
                currentOrders.map(order => (
                  <tr key={order.id} className="hover:bg-[#FCFAFB]/60 transition-colors duration-200">
                    <td className="px-6 py-5 font-bold text-astraea-pink">{order.reference_number}</td>
                    <td className="px-6 py-5 font-semibold text-gray-700">{order.customer_name}</td>
                    <td className="px-6 py-5 capitalize text-gray-500">{order.order_type}</td>
                    <td className="px-6 py-5 text-gray-500">{formatDelivery(order.delivery_method)}</td>
                    <td className="px-6 py-5 font-bold text-gray-700">{formatPrice(order.total_amount)}</td>
                    <td className="px-6 py-5 text-gray-500">{new Date(order.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-5">{getStatusBadge(order.status)}</td>
                    <td className="px-6 py-5">
                      {order.is_paid 
                        ? <span className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">Paid</span>
                        : <span className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">Unpaid</span>
                      }
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusChange(order, e.target.value)}
                          disabled={updatingId === order.id}
                          className="border border-gray-200 bg-white rounded-xl px-3 py-2 text-xs font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-astraea-pink disabled:opacity-60"
                        >
                          {statusOptions.map(status => (
                            <option key={status} value={status}>{status.replace('-', ' ')}</option>
                          ))}
                        </select>
                      <Link to={`/admin/orders/${order.id}`} className="px-4 py-2 bg-[#FCFAFB] text-gray-600 rounded-xl font-bold hover:bg-gray-100 transition-colors border border-gray-100 inline-block">
                        View
                      </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {!loading && filteredOrders.length > 0 && (
          <div className="px-8 py-5 border-t border-gray-50 flex items-center justify-between bg-[#FCFAFB]">
            <span className="text-sm font-medium text-gray-500">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredOrders.length)} of {filteredOrders.length} orders
            </span>
            <div className="flex space-x-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded-md border border-gray-300 text-gray-500 disabled:opacity-50 hover:bg-gray-50 flex items-center justify-center"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded-md border border-gray-300 text-gray-500 disabled:opacity-50 hover:bg-gray-50 flex items-center justify-center"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminOrders;


