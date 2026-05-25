import React from 'react';
import { Link } from 'react-router-dom';
import { Globe, AtSign, Video, Mail, Phone, MessageCircle } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-astraea-blush text-astraea-darkgray pt-16 pb-8 border-t border-astraea-rosegold/30 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
          
          {/* Brand & Tagline */}
          <div className="space-y-4">
            <h3 className="font-heading text-2xl font-bold text-astraea-pink">Astraea Collection</h3>
            <p className="text-sm leading-relaxed max-w-sm">
              Handcrafted fuzzy wire flowers that last forever. Perfect for any occasion, our everlasting bouquets bring timeless joy and beauty to your space.
            </p>
            <div className="flex space-x-4 pt-2">
              <a href="#" className="text-astraea-darkgray hover:text-astraea-pink transition-colors">
                <Globe className="h-5 w-5" />
              </a>
              <a href="#" className="text-astraea-darkgray hover:text-astraea-pink transition-colors">
                <AtSign className="h-5 w-5" />
              </a>
              {/* TikTok placeholder icon */}
              <a href="#" className="text-astraea-darkgray hover:text-astraea-pink transition-colors">
                <Video className="h-5 w-5" /> 
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="font-heading text-lg font-bold">Quick Links</h4>
            <ul className="space-y-2">
              {['Home', 'Shop', 'Customize', 'Price List', 'FAQ', 'Contact'].map((item) => (
                <li key={item}>
                  <Link
                    to={item === 'Home' ? '/' : `/${item.toLowerCase().replace(' ', '-')}`}
                    className="text-sm hover:text-astraea-pink transition-colors"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="font-heading text-lg font-bold">Get In Touch</h4>
            <ul className="space-y-3">
              <li className="flex items-center text-sm">
                <Phone className="h-4 w-4 mr-3 text-astraea-rosegold" />
                +63 912 345 6789
              </li>
              <li className="flex items-center text-sm">
                <Mail className="h-4 w-4 mr-3 text-astraea-rosegold" />
                hello@astraea.com
              </li>
            </ul>
            <div className="pt-4">
              <a
                href="#"
                className="inline-flex items-center px-4 py-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-medium rounded-full transition-colors"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Chat on WhatsApp
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-astraea-rosegold/20 text-center flex flex-col md:flex-row justify-between items-center text-xs text-astraea-darkgray/70">
          <p>&copy; 2024 Astraea Collection. All rights reserved.</p>
          <div className="mt-4 md:mt-0 space-x-4">
            <Link to="/privacy" className="hover:text-astraea-pink">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-astraea-pink">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
