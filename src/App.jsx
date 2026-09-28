import React from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';

// Customer Pages
import Home from './pages/customer/Home';
import Shop from './pages/customer/Shop';
import ShopDetail from './pages/customer/ShopDetail';
import Customize from './pages/customer/Customize';
import OtherProducts from './pages/customer/OtherProducts';
import OtherProductDetail from './pages/customer/OtherProductDetail';
import Cart from './pages/customer/Cart';
import Checkout from './pages/customer/Checkout';
import TrackOrder from './pages/customer/TrackOrder';
import FAQ from './pages/customer/FAQ';
import Contact from './pages/customer/Contact';

// Admin Pages
import AdminLayout from './components/AdminLayout';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminOrders from './pages/admin/AdminOrders';
import AdminOrderDetail from './pages/admin/AdminOrderDetail';
import AdminInventory from './pages/admin/AdminInventory';
import AdminBouquets from './pages/admin/AdminBouquets';
import AdminOtherProducts from './pages/admin/AdminOtherProducts';
import AdminReviews from './pages/admin/AdminReviews';
import AdminSettings from './pages/admin/AdminSettings';

const CustomerLayout = () => (
  <div className="flex flex-col min-h-screen">
    <Navbar />
    <main className="flex-grow">
      <Outlet />
    </main>
    <Footer />
  </div>
);

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <NotificationProvider>
          <Router>
            <Routes>
            {/* Customer Routes */}
            <Route element={<CustomerLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/shop/:id" element={<ShopDetail />} />
              <Route path="/customize" element={<Customize />} />
              <Route path="/other-products" element={<OtherProducts />} />
              <Route path="/other-products/:id" element={<OtherProductDetail />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/track-order" element={<TrackOrder />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="*" element={<div className="text-center p-20">Page Coming Soon</div>} />
            </Route>

            {/* Admin Routes */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/orders" element={<AdminOrders />} />
              <Route path="/admin/orders/:id" element={<AdminOrderDetail />} />
              <Route path="/admin/inventory" element={<AdminInventory />} />
              <Route path="/admin/bouquets" element={<AdminBouquets />} />
              <Route path="/admin/other-products" element={<AdminOtherProducts />} />
              <Route path="/admin/reviews" element={<AdminReviews />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
            </Route>
            </Routes>
          </Router>
        </NotificationProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
