import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart, Menu, X } from 'lucide-react';

import { useCart } from '../context/CartContext';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { cartCount } = useCart();

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Shop', path: '/shop' },
    { name: 'Customize', path: '/customize' },
    { name: 'Price List', path: '/price-list' },
    { name: 'Track Order', path: '/track-order' },
    { name: 'Contact', path: '/contact' },
  ];

  const isActive = (path) => {
    if (path === '/' && location.pathname !== '/') return false;
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-astraea-rosegold/20 shadow-sm animate-fade-in transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 md:h-20">
          
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="font-heading text-xl sm:text-2xl md:text-3xl font-bold text-astraea-pink tracking-wide">
              Astraea Collection
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className={`text-sm font-medium transition-colors hover:text-astraea-pink
                  ${isActive(link.path) ? 'text-astraea-pink border-b-2 border-astraea-pink' : 'text-astraea-darkgray'}`}
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Cart Icon & Mobile Toggle */}
          <div className="flex items-center space-x-4">
            <Link to="/cart" className="relative min-h-11 min-w-11 p-2 flex items-center justify-center text-astraea-darkgray hover:text-astraea-pink transition-colors">
              <ShoppingCart className="h-6 w-6" />
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-astraea-pink rounded-full">
                  {cartCount}
                </span>
              )}
            </Link>
            
            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="min-h-11 min-w-11 flex items-center justify-center text-astraea-darkgray hover:text-astraea-pink focus:outline-none"
                aria-label={isOpen ? 'Close menu' : 'Open menu'}
              >
                {isOpen ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      <div className={`md:hidden fixed inset-0 z-40 ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <div className={`absolute inset-0 bg-black/20 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setIsOpen(false)}></div>
        <div className={`absolute right-0 top-0 h-full w-full max-w-sm bg-white shadow-xl flex flex-col pt-20 px-6 space-y-2 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.path}
              onClick={() => setIsOpen(false)}
              className={`min-h-12 flex items-center text-lg font-medium border-b border-astraea-rosegold/10 py-3
                ${isActive(link.path) ? 'text-astraea-pink' : 'text-astraea-darkgray'}`}
            >
              {link.name}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
