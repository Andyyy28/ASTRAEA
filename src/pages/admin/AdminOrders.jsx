import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Search, Filter, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
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

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('orders').select('*');
    if (data) setOrders(data);
    setLoading(false);
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
      case 'being-made': return <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold capitalize">Being Made</span>;
      case 'ready': return <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold capitalize">Ready</span>;
      case 'completed': return <span className="px-2.5 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-bold capitalize">Completed</span>;
      case 'cancelled': return <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold capitalize">Cancelled</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-800">Orders Management</h1>
      
      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-4">
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
            className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-astraea-pink"
          >
            <option>All</option>
            <option>Pending</option>
            <option>Being-Made</option>
            <option>Ready</option>
            <option>Completed</option>
            <option>Cancelled</option>
          </select>
          <select 
            value={typeFilter}
            onChange={(e) => {setTypeFilter(e.target.value); setCurrentPage(1);}}
            className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-astraea-pink"
          >
            <option>All Types</option>
            <option>Ready-Made</option>
            <option>Custom</option>
          </select>
        </div>
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <span className="text-sm font-medium text-gray-600 flex items-center"><Filter className="w-4 h-4 mr-2" /> Date Range:</span>
          <input 
            type="date" 
            value={dateFrom}
            onChange={(e) => {setDateFrom(e.target.value); setCurrentPage(1);}}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-astraea-pink"
          />
          <span className="text-gray-400">to</span>
          <input 
            type="date" 
            value={dateTo}
            onChange={(e) => {setDateTo(e.target.value); setCurrentPage(1);}}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-astraea-pink"
          />
          <button 
            onClick={() => {
              setSearch(''); setStatusFilter('All'); setTypeFilter('All Types'); setDateFrom(''); setDateTo(''); setCurrentPage(1);
            }}
            className="text-sm text-astraea-pink hover:underline font-medium ml-auto"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500">
                <th className="px-6 py-4 font-medium">Reference #</th>
                <th className="px-6 py-4 font-medium">Customer Name</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium">Delivery</th>
                <th className="px-6 py-4 font-medium cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('total_amount')}>
                  <div className="flex items-center">Total <ArrowUpDown className="w-4 h-4 ml-1" /></div>
                </th>
                <th className="px-6 py-4 font-medium cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('created_at')}>
                  <div className="flex items-center">Date <ArrowUpDown className="w-4 h-4 ml-1" /></div>
                </th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Paid</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {loading ? (
                <tr><td colSpan="9" className="text-center py-10"><div className="w-6 h-6 border-2 border-astraea-pink border-t-transparent rounded-full animate-spin mx-auto"></div></td></tr>
              ) : currentOrders.length === 0 ? (
                <tr><td colSpan="9" className="text-center py-10 text-gray-500">No orders found.</td></tr>
              ) : (
                currentOrders.map(order => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-astraea-pink">{order.reference_number}</td>
                    <td className="px-6 py-4 font-medium text-gray-800">{order.customer_name}</td>
                    <td className="px-6 py-4 capitalize text-gray-600">{order.order_type}</td>
                    <td className="px-6 py-4 capitalize text-gray-600">{order.delivery_method}</td>
                    <td className="px-6 py-4 font-bold text-gray-800">₱{Number(order.total_amount).toFixed(2)}</td>
                    <td className="px-6 py-4 text-gray-600">{new Date(order.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4">{getStatusBadge(order.status)}</td>
                    <td className="px-6 py-4">
                      {order.is_paid 
                        ? <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-md">Paid</span>
                        : <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md">Unpaid</span>
                      }
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link to={`/admin/orders/${order.id}`} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md font-medium hover:bg-gray-200 transition-colors text-xs inline-block">
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {!loading && filteredOrders.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredOrders.length)} of {filteredOrders.length} orders
            </span>
            <div className="flex space-x-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded-md border border-gray-300 text-gray-500 disabled:opacity-50 hover:bg-gray-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded-md border border-gray-300 text-gray-500 disabled:opacity-50 hover:bg-gray-50"
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
