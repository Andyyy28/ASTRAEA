import React, { useState } from 'react';
import { Mail, MessageCircle, Clock, Globe, AtSign, Check } from 'lucide-react';

const Contact = () => {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate API call to save to contact_messages table
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      setFormData({ name: '', email: '', message: '' });
    }, 1000);
  };

  return (
    <div className="py-8 md:py-16 bg-astraea-blush/10 min-h-screen animate-fade-in">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-10 md:mb-16">
          <h1 className="font-heading text-2xl md:text-4xl font-bold text-astraea-darkgray mb-4">
            Get in Touch
          </h1>
          <p className="text-sm md:text-base text-astraea-darkgray/70">
            We'd love to hear from you. Send us a message or reach out on WhatsApp.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-0 bg-white rounded-3xl shadow-sm border border-astraea-rosegold/20 overflow-hidden">
          
          {/* Left Column: Form */}
          <div className="lg:w-1/2 p-4 md:p-12 order-2 lg:order-1">
            <h2 className="font-heading text-xl md:text-3xl font-bold text-astraea-darkgray mb-8">Send a Message</h2>
            
            {submitted ? (
              <div className="bg-green-50 border border-green-200 text-green-700 p-8 rounded-2xl text-center animate-fade-in">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="font-bold text-xl mb-2">Message Sent!</h3>
                <p>Thank you for reaching out. We will get back to you as soon as possible.</p>
                <button 
                  onClick={() => setSubmitted(false)}
                  className="mt-6 px-6 py-2 bg-white text-green-600 rounded-full border border-green-200 font-medium hover:bg-green-50"
                >
                  Send Another
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-astraea-darkgray mb-2">Full Name</label>
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full border border-astraea-rosegold/40 rounded-xl p-4 focus:ring-2 focus:ring-astraea-pink outline-none bg-astraea-blush/20"
                    placeholder="Jane Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-astraea-darkgray mb-2">Email Address</label>
                  <input 
                    type="email" 
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full border border-astraea-rosegold/40 rounded-xl p-4 focus:ring-2 focus:ring-astraea-pink outline-none bg-astraea-blush/20"
                    placeholder="jane@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-astraea-darkgray mb-2">Message</label>
                  <textarea 
                    rows="5"
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({...formData, message: e.target.value})}
                    className="w-full border border-astraea-rosegold/40 rounded-xl p-4 focus:ring-2 focus:ring-astraea-pink outline-none bg-astraea-blush/20 resize-none"
                    placeholder="How can we help you?"
                  ></textarea>
                </div>
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-astraea-pink text-white rounded-full font-bold text-lg hover:bg-astraea-pink/90 transition-all shadow-md hover:-translate-y-1 transform disabled:opacity-70 disabled:hover:translate-y-0"
                >
                  {loading ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            )}
          </div>

          {/* Right Column: Contact Details */}
          <div className="lg:w-1/2 p-4 md:p-12 bg-astraea-blush/30 lg:border-l border-astraea-rosegold/20 order-1 lg:order-2">
            <h2 className="font-heading text-xl md:text-3xl font-bold text-astraea-darkgray mb-8">Contact Information</h2>
            
            <div className="space-y-8">
              
              {/* WhatsApp */}
              <div className="bg-white p-6 rounded-2xl border border-astraea-rosegold/20 flex flex-col items-center text-center shadow-sm">
                <MessageCircle className="w-10 h-10 text-astraea-pink mb-4" />
                <h3 className="font-bold text-lg mb-2">Quickest Reply</h3>
                <a 
                  href="https://wa.me/639123456789" 
                  target="_blank" 
                  rel="noreferrer"
                  className="w-full min-h-11 px-8 py-3 bg-[#25D366] text-white rounded-full font-bold hover:bg-[#1ebe5d] transition-colors mt-2"
                >
                  Chat with us on WhatsApp
                </a>
              </div>

              {/* Contact List */}
              <ul className="space-y-6">
                <li className="flex items-start">
                  <Mail className="w-6 h-6 text-astraea-pink mr-4 shrink-0" />
                  <div>
                    <h4 className="font-bold">Email Address</h4>
                    <p className="text-astraea-darkgray/70">hello@astraeacollection.com</p>
                  </div>
                </li>
                
                <li className="flex items-start">
                  <Clock className="w-6 h-6 text-astraea-pink mr-4 shrink-0" />
                  <div>
                    <h4 className="font-bold">Business Hours</h4>
                    <p className="text-astraea-darkgray/70">Monday – Saturday: 9:00 AM – 7:00 PM</p>
                    <p className="text-astraea-darkgray/70">Sunday: 10:00 AM – 5:00 PM</p>
                  </div>
                </li>
              </ul>
              
              <div className="pt-6 border-t border-astraea-rosegold/20">
                <h4 className="font-bold mb-4">Follow Us</h4>
                <div className="flex gap-4">
                  <a href="#" className="w-12 h-12 bg-white rounded-full flex items-center justify-center border border-astraea-rosegold/30 hover:border-astraea-pink hover:text-astraea-pink transition-colors shadow-sm">
                    <Globe className="w-6 h-6" />
                  </a>
                  <a href="#" className="w-12 h-12 bg-white rounded-full flex items-center justify-center border border-astraea-rosegold/30 hover:border-astraea-pink hover:text-astraea-pink transition-colors shadow-sm">
                    <AtSign className="w-6 h-6" />
                  </a>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Contact;
