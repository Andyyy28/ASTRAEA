import React from 'react';
import { Link } from 'react-router-dom';
import { Globe, AtSign, Video, Mail, Phone, MessageCircle } from 'lucide-react';

const Footer = () => {
  const heartIcon = String.fromCodePoint(9825);
  const starIcon = String.fromCodePoint(9733);

  return (
    <footer className="bg-astraea-cream text-astraea-darkgray pt-16 pb-8 border-t-2 border-dashed border-astraea-pink mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
          
          {/* Brand & Tagline */}
          <div className="space-y-4">
            <h3 className="font-heading flex items-center gap-3 text-2xl font-extrabold text-[#DE3163]">
              <img src="/web_logo.png" alt="Astraea Collection logo" className="h-[45px] w-[45px] rounded-full object-cover" />
              Astraea Collection
            </h3>
            <p className="text-sm leading-relaxed max-w-sm">
              Handcrafted fuzzy wire flowers that last forever. Perfect for any occasion, our everlasting bouquets bring timeless joy and beauty to your space.
            </p>
            <div className="flex space-x-4 pt-2">
              <a href="https://www.facebook.com/share/1RzvhQpxG1/" target="_blank" rel="noreferrer" className="text-astraea-darkgray hover:text-astraea-pink transition-colors">
                <Globe className="h-5 w-5" />
              </a>
              <a href="https://www.facebook.com/share/18yY1YAP5n/" target="_blank" rel="noreferrer" className="text-astraea-darkgray hover:text-astraea-pink transition-colors">
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
            <h4 className="section-heading text-lg">{heartIcon} Quick Links</h4>
            <ul className="space-y-2">
              {[
                { name: 'Home', path: '/' },
                { name: 'Shop', path: '/shop' },
                { name: 'Customize', path: '/customize' },
                { name: 'Other Products', path: '/other-products' },
                { name: 'FAQ', path: '/faq' },
                { name: 'Contact', path: '/contact' }
              ].map((item) => (
                <li key={item.name} className="rounded-full">
                  <Link
                    to={item.path}
                    className="inline-flex rounded-full px-3 py-1 text-sm font-semibold hover:bg-white/80 hover:text-astraea-pink transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="section-heading text-lg">{starIcon} Get In Touch</h4>
            <ul className="space-y-3">
              <li className="flex items-center text-sm">
                <Phone className="h-4 w-4 mr-3 text-astraea-rosegold" />
                09071757540
              </li>
              <li className="flex items-center text-sm">
                <Mail className="h-4 w-4 mr-3 text-astraea-rosegold" />
                rjean4393@gmail.com
              </li>
            </ul>
            <div className="pt-4">
              <a
                href="https://www.facebook.com/share/18yY1YAP5n/"
                target="_blank"
                rel="noreferrer"
                className="kawaii-btn bg-[#E8F0FE] text-[#1A56DB] border-[#A8C0F8]"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Chat on Messenger
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-dashed border-astraea-pink/40 text-center flex flex-col items-center text-xs text-astraea-darkgray/70">
  <p>&copy; 2026 Astraea Collection. All rights reserved.</p>
</div>
      </div>
    </footer>
  );
};

export default Footer;
