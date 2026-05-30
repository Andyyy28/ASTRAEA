import React, { useEffect, useState } from 'react';
import { Mail, MessageCircle, Clock, Globe, AtSign, Check, Phone } from 'lucide-react';

const Contact = () => {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const heartIcon = String.fromCodePoint(9825);
  const flowerIcon = String.fromCodePoint(10047);
  const starIcon = String.fromCodePoint(9733);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      setFormData({ name: '', email: '', message: '' });
    }, 1000);
  };

  return (
    <div className="py-8 md:py-16 bg-astraea-cream min-h-screen animate-fade-in">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 md:mb-16">
          <h1 className="section-heading text-2xl md:text-4xl mb-4">Get in Touch</h1>
          <p className="font-accent text-2xl text-astraea-rosegold">We'd love to hear from you. Send us a message or reach out on Messenger.</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-0 bg-[#FFFDFE] rounded-3xl shadow-[4px_4px_0px_#F9A8C9] border-2 border-dashed border-astraea-pink overflow-hidden">
          <div className="lg:w-1/2 p-4 md:p-12 order-2 lg:order-1">
            <h2 className="section-heading text-xl md:text-3xl mb-8">{flowerIcon} Send a Message</h2>
            {submitted ? (
              <div className="scrapbook-card bg-astraea-mint/30 text-[#2D7A5F] text-center animate-fade-in">
                <div className="w-16 h-16 bg-astraea-mint rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-[#A8DFC9]"><Check className="w-8 h-8 text-[#2D7A5F]" /></div>
                <h3 className="font-bold text-xl mb-2">Message Sent!</h3>
                <p>Thank you for reaching out. We will get back to you as soon as possible.</p>
                <button onClick={() => setSubmitted(false)} className="kawaii-btn-outline mt-6">Send Another</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div><label className="block text-sm font-medium text-[#C4658A] mb-2">Full Name</label><input type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="kawaii-input" placeholder="Jane Doe" /></div>
                <div><label className="block text-sm font-medium text-[#C4658A] mb-2">Email Address</label><input type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="kawaii-input" placeholder="jane@example.com" /></div>
                <div><label className="block text-sm font-medium text-[#C4658A] mb-2">Message</label><textarea rows="5" required value={formData.message} onChange={(e) => setFormData({...formData, message: e.target.value})} className="kawaii-input min-h-[100px] resize-none" placeholder="How can we help you?"></textarea></div>
                <button type="submit" disabled={loading} className="kawaii-btn-primary w-full py-4 text-lg">{loading ? 'Sending...' : 'Send Message'}</button>
              </form>
            )}
          </div>
          <div className="lg:w-1/2 p-4 md:p-12 bg-astraea-blush/30 lg:border-l-2 lg:border-dashed border-astraea-pink order-1 lg:order-2">
            <h2 className="section-heading text-xl md:text-3xl mb-8">{starIcon} Contact Information</h2>
            <div className="space-y-8">
              <div className="scrapbook-card bg-white/90 text-center">
                <MessageCircle className="w-10 h-10 text-astraea-pink mb-4 mx-auto" />
                <h3 className="font-bold text-lg mb-2">Quickest Reply</h3>
                <a href="https://www.facebook.com/share/18yY1YAP5n/" target="_blank" rel="noreferrer" className="kawaii-btn w-full justify-center mt-2 bg-[#E8F0FE] border-[#A8C0F8] text-[#1A56DB]">Chat on Messenger {heartIcon}</a>
                <a href="tel:09071757540" className="kawaii-btn w-full justify-center mt-3 bg-[#D5F0E8] border-[#A8DFC9] text-[#2D7A5F]">Call Us {heartIcon}</a>
              </div>
              <ul className="space-y-6">
                <li className="flex items-start"><Phone className="w-6 h-6 text-astraea-pink mr-4 shrink-0" /><div><h4 className="font-bold">Phone Number</h4><p className="text-astraea-darkgray/70">09071757540</p></div></li>
                <li className="flex items-start"><Mail className="w-6 h-6 text-astraea-pink mr-4 shrink-0" /><div><h4 className="font-bold">Email Address</h4><p className="text-astraea-darkgray/70">rjean4393@gmail.com</p></div></li>
                <li className="flex items-start"><Clock className="w-6 h-6 text-astraea-pink mr-4 shrink-0" /><div><h4 className="font-bold">Business Hours</h4><p className="text-astraea-darkgray/70">Monday - Saturday: 9:00 AM - 7:00 PM</p><p className="text-astraea-darkgray/70">Sunday: 10:00 AM - 5:00 PM</p></div></li>
              </ul>
              <div className="pt-6 border-t-2 border-dashed border-astraea-pink/30">
                <h4 className="font-bold mb-4">Follow Us</h4>
                <div className="flex gap-4">
                  <a href="https://www.facebook.com/share/1RzvhQpxG1/" target="_blank" rel="noreferrer" className="w-12 h-12 bg-white rounded-full flex items-center justify-center border-2 border-dashed border-astraea-pink/40 hover:text-astraea-pink transition-colors shadow-[3px_3px_0px_#F9A8C9]"><Globe className="w-6 h-6" /></a>
                  <a href="https://www.facebook.com/share/18yY1YAP5n/" target="_blank" rel="noreferrer" className="w-12 h-12 bg-white rounded-full flex items-center justify-center border-2 border-dashed border-astraea-pink/40 hover:text-astraea-pink transition-colors shadow-[3px_3px_0px_#F9A8C9]"><AtSign className="w-6 h-6" /></a>
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
