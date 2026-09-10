import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Clock, Mail, MapPin } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="bg-slate-50 text-slate-600 border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand Col */}
          <div className="space-y-4 md:col-span-1">
            <Link to="/" className="flex items-center gap-3 group">
              <img src="/logo.png" alt="VitaLink Logo" className="h-10 w-auto object-contain" />
              <span className="text-2xl font-black tracking-tight text-slate-900">
                Vita<span className="text-teal-600">Link</span>
              </span>
            </Link>
            <p className="text-xs text-teal-700 font-bold uppercase tracking-wider">
              Healthcare made simpler, smarter and more connected.
            </p>
            <p className="text-sm text-slate-500 leading-relaxed">
              Bringing patients, verified clinicians, AI health guidance, digital prescriptions, and health records together into one trusted platform.
            </p>
          </div>

          {/* Platform Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">Platform</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/doctors" className="hover:text-teal-700 transition">
                  Find a Doctor
                </Link>
              </li>
              <li>
                <Link to="/doctors" className="hover:text-teal-700 transition">
                  Book Appointment
                </Link>
              </li>
              <li>
                <Link to="/patient/ai-assistant" className="hover:text-teal-700 transition">
                  AI Health Assistant
                </Link>
              </li>
              <li>
                <Link to="/patient/orders" className="hover:text-teal-700 transition">
                  Medicine Delivery
                </Link>
              </li>
              <li>
                <Link to="/patient/records" className="hover:text-teal-700 transition">
                  Health Records
                </Link>
              </li>
            </ul>
          </div>

          {/* Company & Legal */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">Company & Legal</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a href="/#about" className="hover:text-teal-700 transition">
                  About
                </a>
              </li>
              <li>
                <a href="/#contact" className="hover:text-teal-700 transition">
                  Contact
                </a>
              </li>
              <li>
                <a href="/#faq" className="hover:text-teal-700 transition">
                  FAQ
                </a>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-teal-700 transition">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-teal-700 transition">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">Contact</h4>
            <div className="space-y-3 text-sm text-slate-600">
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-teal-600 shrink-0" />
                <a href="mailto:support@vitalink.com" className="hover:text-teal-700 transition">
                  support@vitalink.com
                </a>
              </div>
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-teal-600 shrink-0" />
                <span>24/7 Healthcare Support</span>
              </div>
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
                <span>India</span>
              </div>
            </div>
          </div>
        </div>

        {/* Emergency Medical Disclaimer Banner */}
        <div className="mt-12 p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-3.5">
          <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-600 leading-relaxed">
            <strong className="text-amber-800">Medical Notice:</strong> VitaLink provides digital healthcare connectivity and guidance. VitaLink does not replace professional emergency services. In case of a severe medical emergency (such as acute chest pain, stroke symptoms, or severe trauma), immediately call local emergency services or visit the nearest hospital emergency room.
          </p>
        </div>

        <div className="mt-8 pt-8 border-t border-slate-200 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} VitaLink Healthcare Technologies. All rights reserved. Smarter Healthcare. Connected.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
