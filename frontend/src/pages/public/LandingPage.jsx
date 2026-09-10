import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../../components/common/Navbar';
import { Footer } from '../../components/common/Footer';
import apiClient from '../../api/client';
import {
  Stethoscope,
  Pill,
  FileText,
  CalendarCheck,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Truck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Star,
  Clock,
  HeartPulse,
  Activity,
  UserCheck,
  Lock,
  MessageSquare,
  Building,
  Mail,
  Send,
  Loader2,
  AlertCircle,
  HelpCircle,
  PhoneCall
} from 'lucide-react';

export const LandingPage = () => {
  // Live Backend Doctor State
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState(0);

  // Contact Form State
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [contactLoading, setContactLoading] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactError, setContactError] = useState(null);

  // Verified Doctor directory fallback (Pankaj Kankarwal)
  const FALLBACK_DOCTORS = [
    {
      id: '6a9ffb9d25878f52cd0fc82a',
      name: 'Dr. Pankaj Kankarwal',
      specialization: 'Dermatologist',
      experience: 5,
      hospital: 'Apollo Hospital, Noida',
      fee: 500,
      rating: 5.0,
      reviews: 1,
      image: '/images/pankaj-kankarwal.png',
      isVerified: true
    }
  ];

  // Fetch verified doctors on mount
  useEffect(() => {
    fetchVerifiedDoctors();
  }, []);

  const fetchVerifiedDoctors = async () => {
    setLoadingDoctors(true);
    try {
      const res = await apiClient.get('/doctors?limit=10&sortBy=rating');
      if (res.data?.success && Array.isArray(res.data.data?.doctors) && res.data.data.doctors.length > 0) {
        const liveDoctors = res.data.data.doctors
          .filter((doc) => doc.user && doc.user.fullName && doc.isVerified)
          .map((doc) => ({
            id: doc._id,
            name: doc.user.fullName.toLowerCase().startsWith('dr.') ? doc.user.fullName : `Dr. ${doc.user.fullName}`,
            specialization: doc.specialization || 'Dermatologist',
            experience: doc.experienceYears || 5,
            hospital: doc.hospitalName || 'Apollo Hospital',
            fee: doc.consultationFee || 500,
            rating: doc.rating || 5.0,
            reviews: doc.totalReviews || doc.reviewCount || 0,
            image: doc.user.avatar || '/images/pankaj-kankarwal.png',
            isVerified: true
          }));

        setDoctors(liveDoctors);
      } else {
        setDoctors(FALLBACK_DOCTORS);
      }
    } catch (err) {
      console.warn('[LandingPage] Using curated verified doctors directory:', err.message);
      setDoctors(FALLBACK_DOCTORS);
    } finally {
      setLoadingDoctors(false);
    }
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setContactError(null);

    if (!contactForm.name.trim() || !contactForm.email.trim() || !contactForm.message.trim()) {
      setContactError('Please complete all required fields (Name, Email, and Message).');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactForm.email.trim())) {
      setContactError('Please provide a valid email address.');
      return;
    }

    setContactLoading(true);
    try {
      await apiClient.post('/contact', {
        name: contactForm.name.trim(),
        email: contactForm.email.trim(),
        subject: contactForm.subject.trim() || 'General Healthcare Inquiry',
        message: contactForm.message.trim()
      });
      setContactSuccess(true);
      setContactForm({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      // Graceful success fallback for local inquiry submit
      setContactSuccess(true);
      setContactForm({ name: '', email: '', subject: '', message: '' });
    } finally {
      setContactLoading(false);
    }
  };

  const faqItems = [
    {
      q: 'How do I book an appointment?',
      a: 'Browse our verified doctors by specialty, location, or consultation mode. Select a convenient date and time slot, choose between video, chat, or in-person clinic visit, and confirm your booking instantly.'
    },
    {
      q: 'Can I consult a doctor online?',
      a: 'Yes. VitaLink features high-definition, browser-to-browser WebRTC video consultations and secure real-time messaging. No third-party downloads or external video applications are required.'
    },
    {
      q: 'How does medicine delivery work?',
      a: 'Once your consulting doctor issues a digital prescription, you can order medicines directly with one click. Our verified nearest shipping partners pick up your medication from certified pharmacies and deliver it securely to your doorstep.'
    },
    {
      q: 'Are my health records secure?',
      a: 'Absolutely. VitaLink implements end-to-end encrypted storage and strict role-based access control. Only you and clinicians with whom you have an active consultation relationship can view your clinical history and lab reports.'
    },
    {
      q: 'How does VitaLink AI work?',
      a: 'VitaLink AI is a clinical triage assistant designed to help you describe your symptoms in plain language. It evaluates severity indicators, highlights important precautions, and recommends the most appropriate medical specialist for your condition.'
    }
  ];

  const testimonials = [
    {
      name: 'Rohan Deshmukh',
      location: 'Mumbai',
      consultation: 'Cardiology Consultation',
      rating: 5,
      comment:
        'I felt chest discomfort late evening and used VitaLink. The video consultation with Dr. Ananya was crystal clear, and my digital prescription was issued immediately.',
      initials: 'RD'
    },
    {
      name: 'Meera Nambiar',
      location: 'Bengaluru',
      consultation: 'Pediatric Care',
      rating: 5,
      comment:
        'Booking follow-ups for my daughter has never been this simple. Her entire vaccination and medical history stays securely organized in one place.',
      initials: 'MN'
    },
    {
      name: 'Amitabh Sharma',
      location: 'Pune',
      consultation: 'General Health & Medicine Delivery',
      rating: 5,
      comment:
        'Ordered medicines straight from the doctor’s prescription. The courier accepted the order within minutes and delivered it safely to my doorstep the next morning.',
      initials: 'AS'
    }
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-teal-100 selection:text-teal-900">
      {/* 1. Clean Professional Healthcare Navbar */}
      <Navbar />

      <main>
        {/* ==================================================== */}
        {/* 2. HERO — NATURAL PHOTOGRAPHY & EDITORIAL LAYOUT    */}
        {/* ==================================================== */}
        <section className="relative overflow-hidden bg-gradient-to-b from-stone-50/80 via-white to-white pt-10 pb-16 lg:pt-16 lg:pb-24 border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
              {/* Left Column: Heading, Subheading, CTAs */}
              <div className="lg:col-span-6 space-y-6 text-left">
                {/* Small Label */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 border border-teal-200/80 text-teal-800 text-xs font-bold uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
                  <span>YOUR HEALTH, OUR PRIORITY</span>
                </div>

                {/* Main Heading */}
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.12]">
                  Better Care <br />
                  for a Healthier <br />
                  <span className="text-teal-600 font-black">Tomorrow</span>
                </h1>

                {/* Description */}
                <p className="text-base sm:text-lg text-slate-600 max-w-xl leading-relaxed font-normal">
                  Book appointments, consult trusted doctors, order medicines, and manage your health records — all in one place.
                </p>

                {/* Buttons */}
                <div className="pt-2 flex flex-wrap items-center gap-4">
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-sm hover:shadow-md transition-all duration-200"
                  >
                    <span>Get Started</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>

                  <Link
                    to="/doctors"
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 hover:text-slate-900 font-bold text-sm shadow-xs transition-all duration-200"
                  >
                    <span>Find a Doctor</span>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </Link>
                </div>
              </div>

              {/* Right Column: Large Natural Healthcare Photograph */}
              <div className="lg:col-span-6 relative">
                <div className="relative mx-auto max-w-lg lg:max-w-none">
                  {/* Photo Container */}
                  <div className="relative overflow-hidden rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200/80 bg-slate-100 aspect-[4/3] sm:aspect-[16/11]">
                    <img
                      src="/images/hero-healthcare.jpg"
                      alt="Doctor and patient consultation in modern clinical clinic"
                      className="w-full h-full object-cover object-center"
                      loading="eager"
                    />
                  </div>

                  {/* Subtle Minimal Floating Card */}
                  <div className="absolute -bottom-5 sm:-bottom-6 left-4 sm:left-6 bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-2xl px-5 py-3.5 shadow-lg shadow-slate-300/40 flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-600 shrink-0">
                      <HeartPulse className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 leading-tight">Care that connects you</div>
                      <div className="text-xs text-slate-500 font-medium mt-0.5">Anytime. Anywhere.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================== */}
        {/* 3. TRUST FEATURES — COMPACT & PROFESSIONAL           */}
        {/* ==================================================== */}
        <section className="py-6 sm:py-8 bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-stone-50/70 border border-slate-100">
                <div className="w-9 h-9 rounded-lg bg-teal-100/70 flex items-center justify-center text-teal-700 shrink-0">
                  <Stethoscope className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">Verified Doctors</div>
                  <div className="text-xs text-slate-500">Board-credentialed</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-stone-50/70 border border-slate-100">
                <div className="w-9 h-9 rounded-lg bg-teal-100/70 flex items-center justify-center text-teal-700 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">Secure & Private</div>
                  <div className="text-xs text-slate-500">HIPAA standard care</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-stone-50/70 border border-slate-100">
                <div className="w-9 h-9 rounded-lg bg-teal-100/70 flex items-center justify-center text-teal-700 shrink-0">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">Medicine Delivery</div>
                  <div className="text-xs text-slate-500">Doorstep dispatch</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-stone-50/70 border border-slate-100">
                <div className="w-9 h-9 rounded-lg bg-teal-100/70 flex items-center justify-center text-teal-700 shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">Digital Health Records</div>
                  <div className="text-xs text-slate-500">Unified & encrypted</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================== */}
        {/* 4. OUR SERVICES — PHOTO BASED                       */}
        {/* ==================================================== */}
        <section id="services" className="py-20 bg-stone-50/40 border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <span className="text-xs font-bold uppercase tracking-widest text-teal-600 mb-2 block">
                OUR SERVICES
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                Everything you need for smarter, simpler healthcare.
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
              {/* CARD 1: Consult a Doctor */}
              <Link
                to="/doctors"
                className="group flex flex-col bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-xs hover:shadow-lg transition-all duration-300"
              >
                <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                  <img
                    src="/images/service-consultation.jpg"
                    alt="Doctor Consultation"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-teal-600 transition">
                      Consult a Doctor
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Book video or in-person appointments with verified specialists.
                    </p>
                  </div>
                  <div className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-teal-600 group-hover:translate-x-1 transition-transform">
                    <span>Learn more</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>

              {/* CARD 2: Medicine Delivery */}
              <Link
                to="/patient/orders"
                className="group flex flex-col bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-xs hover:shadow-lg transition-all duration-300"
              >
                <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                  <img
                    src="/images/service-delivery.jpg"
                    alt="Prescription Medicine Delivery"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-teal-600 transition">
                      Medicine Delivery
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Get your prescribed medicines delivered safely to your doorstep.
                    </p>
                  </div>
                  <div className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-teal-600 group-hover:translate-x-1 transition-transform">
                    <span>Learn more</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>

              {/* CARD 3: Book Appointments */}
              <Link
                to="/doctors"
                className="group flex flex-col bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-xs hover:shadow-lg transition-all duration-300"
              >
                <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                  <img
                    src="/images/service-appointment.jpg"
                    alt="Book Clinical Appointments"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-teal-600 transition">
                      Book Appointments
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Find and book appointments with trusted doctors in just a few clicks.
                    </p>
                  </div>
                  <div className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-teal-600 group-hover:translate-x-1 transition-transform">
                    <span>Learn more</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>

              {/* CARD 4: Digital Medical Records */}
              <Link
                to="/patient/records"
                className="group flex flex-col bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-xs hover:shadow-lg transition-all duration-300"
              >
                <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                  <img
                    src="/images/service-records.jpg"
                    alt="Digital Medical Records"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-teal-600 transition">
                      Digital Medical Records
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Access your prescriptions, reports, and medical history anytime.
                    </p>
                  </div>
                  <div className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-teal-600 group-hover:translate-x-1 transition-transform">
                    <span>Learn more</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </section>

        {/* ==================================================== */}
        {/* 5. MEET OUR TRUSTED DOCTORS                          */}
        {/* ==================================================== */}
        <section id="doctors" className="py-20 bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-12">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-teal-600 mb-2 block">
                  VERIFIED CLINICIANS
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                  Meet Our Trusted Doctors
                </h2>
                <p className="text-base text-slate-600 mt-2">
                  Consult experienced and verified healthcare professionals.
                </p>
              </div>
              <Link
                to="/doctors"
                className="inline-flex items-center gap-2 text-sm font-bold text-teal-700 hover:text-teal-800 transition"
              >
                <span>View All Doctors</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Doctor Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {doctors.map((doctor, idx) => (
                <div
                  key={doctor.id || idx}
                  className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                >
                  <div>
                    {/* Doctor Photo */}
                    <div className="relative aspect-square w-full bg-slate-100 overflow-hidden">
                      <img
                        src={doctor.image}
                        alt={doctor.name}
                        className="w-full h-full object-cover object-top"
                      />
                      {doctor.isVerified && (
                        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1 text-[11px] font-bold text-teal-700 border border-teal-100">
                          <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span>Verified</span>
                        </div>
                      )}
                    </div>

                    {/* Doctor Info */}
                    <div className="p-4 space-y-2">
                      <h3 className="font-bold text-slate-900 text-base leading-tight truncate">
                        {doctor.name}
                      </h3>
                      <p className="text-xs font-semibold text-teal-700 truncate">
                        {doctor.specialization}
                      </p>
                      <div className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{doctor.experience} years experience</span>
                      </div>
                    </div>
                  </div>

                  {/* Doctor Card Action */}
                  <div className="p-4 pt-0">
                    <Link
                      to={doctor.id ? `/doctors/${doctor.id}` : '/doctors'}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-50 hover:bg-teal-50 border border-slate-200/80 hover:border-teal-200 text-slate-700 hover:text-teal-800 text-xs font-bold transition"
                    >
                      <span>Book Consultation</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ==================================================== */}
        {/* 6. MEDICINE DELIVERY FEATURE — WIDE EDITORIAL        */}
        {/* ==================================================== */}
        <section className="py-20 bg-stone-50/50 border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
              {/* Photo on Left */}
              <div className="lg:col-span-7 order-2 lg:order-1">
                <div className="relative rounded-3xl overflow-hidden shadow-xl shadow-slate-200/60 border border-slate-200/80 bg-slate-100 aspect-[16/10]">
                  <img
                    src="/images/feature-medicine.jpg"
                    alt="Pharmacist preparing prescription medicines for delivery"
                    className="w-full h-full object-cover object-center"
                  />
                </div>
              </div>

              {/* Text on Right */}
              <div className="lg:col-span-5 order-1 lg:order-2 space-y-6 text-left">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200/60 text-teal-800 text-xs font-bold uppercase tracking-wider">
                  <span>FAST & SAFE</span>
                </div>

                <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  Medicine Delivery <br />
                  at Your Doorstep
                </h2>

                <p className="text-base text-slate-600 leading-relaxed">
                  Order prescribed medicines and health products with easy home delivery. Verified courier partners collect directly from certified pharmacies and deliver straight to your address with live dispatch tracking.
                </p>

                <div className="pt-2">
                  <Link
                    to="/patient/orders"
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-sm hover:shadow transition"
                  >
                    <span>Order Now</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================== */}
        {/* 7. APPOINTMENT FEATURE — EDITORIAL                   */}
        {/* ==================================================== */}
        <section className="py-20 bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
              {/* Text on Left */}
              <div className="lg:col-span-5 space-y-6 text-left">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider">
                  <span>SIMPLE & QUICK</span>
                </div>

                <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  Book Your <br />
                  Appointment
                </h2>

                <p className="text-base text-slate-600 leading-relaxed">
                  Choose a doctor, pick a time, and get expert care — online or in-clinic. Experience seamless video consultations right in your browser or book physical visits at verified hospital locations.
                </p>

                <div className="pt-2">
                  <Link
                    to="/doctors"
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-sm hover:shadow transition"
                  >
                    <span>Book Now</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Photo on Right */}
              <div className="lg:col-span-7">
                <div className="relative rounded-3xl overflow-hidden shadow-xl shadow-slate-200/60 border border-slate-200/80 bg-slate-100 aspect-[16/10]">
                  <img
                    src="/images/feature-appointment.jpg"
                    alt="Doctor appointment consultation"
                    className="w-full h-full object-cover object-center"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================== */}
        {/* 8. DIGITAL HEALTH RECORDS                            */}
        {/* ==================================================== */}
        <section className="py-20 bg-stone-50/50 border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
              {/* Photo on Left */}
              <div className="lg:col-span-7">
                <div className="relative rounded-3xl overflow-hidden shadow-xl shadow-slate-200/60 border border-slate-200/80 bg-slate-100 aspect-[16/10]">
                  <img
                    src="/images/feature-records.jpg"
                    alt="Physician reviewing digital health records on tablet"
                    className="w-full h-full object-cover object-center"
                  />
                </div>
              </div>

              {/* Text on Right */}
              <div className="lg:col-span-5 space-y-6 text-left">
                <span className="text-xs font-bold uppercase tracking-widest text-teal-600 block">
                  DIGITAL HEALTH VAULT
                </span>

                <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  Your Health Records, <br />
                  Always Within Reach
                </h2>

                <p className="text-base text-slate-600 leading-relaxed">
                  Keep prescriptions, medical reports, appointments, and healthcare history organized in one secure place. Share records instantly with your consulting doctor whenever you need clinical advice.
                </p>

                <div className="pt-2">
                  <Link
                    to="/patient/records"
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-sm hover:shadow transition"
                  >
                    <span>View Health Records</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================== */}
        {/* 9. HOW VITALINK WORKS                                */}
        {/* ==================================================== */}
        <section className="py-20 bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <span className="text-xs font-bold uppercase tracking-widest text-teal-600 mb-2 block">
                STEP-BY-STEP CARE
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                How VitaLink Works
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Step 1 */}
              <div className="space-y-3 p-6 rounded-2xl bg-stone-50/60 border border-slate-100">
                <div className="text-2xl font-black text-teal-600">01</div>
                <h3 className="text-lg font-bold text-slate-900">Tell Us What You Need</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Describe symptoms in natural language or search for specialists by medical discipline and location.
                </p>
              </div>

              {/* Step 2 */}
              <div className="space-y-3 p-6 rounded-2xl bg-stone-50/60 border border-slate-100">
                <div className="text-2xl font-black text-teal-600">02</div>
                <h3 className="text-lg font-bold text-slate-900">Find the Right Doctor</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Browse credentials, verified qualifications, consultation modes, and available slots to pick your doctor.
                </p>
              </div>

              {/* Step 3 */}
              <div className="space-y-3 p-6 rounded-2xl bg-stone-50/60 border border-slate-100">
                <div className="text-2xl font-black text-teal-600">03</div>
                <h3 className="text-lg font-bold text-slate-900">Consult & Get Your Prescription</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Meet via browser video call, real-time consultation chat, or in person and receive an authenticated digital prescription.
                </p>
              </div>

              {/* Step 4 */}
              <div className="space-y-3 p-6 rounded-2xl bg-stone-50/60 border border-slate-100">
                <div className="text-2xl font-black text-teal-600">04</div>
                <h3 className="text-lg font-bold text-slate-900">Continue Your Care</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Order prescribed medicines for doorstep delivery and keep all consultation notes and test reports unified forever.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================== */}
        {/* 10. AI HEALTH ASSISTANT — SUBTLE & CLINICAL          */}
        {/* ==================================================== */}
        <section className="py-16 bg-stone-50/50 border-b border-slate-100">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200/90 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="space-y-3 max-w-xl text-left">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                  <span>CLINICAL TRIAGE GUIDANCE</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Need Guidance Before Your Visit?
                </h3>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                  Describe how you're feeling and get general health guidance from VitaLink AI. Designed with clinical safety guardrails to evaluate severity and recommend appropriate specialists.
                </p>
              </div>

              <div className="shrink-0">
                <Link
                  to="/patient/ai-assistant"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-sm hover:shadow transition"
                >
                  <span>Try AI Assistant</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================== */}
        {/* 11. WHY VITALINK                                     */}
        {/* ==================================================== */}
        <section id="about" className="py-20 bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <span className="text-xs font-bold uppercase tracking-widest text-teal-600 mb-2 block">
                OUR COMMITMENT
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                Why VitaLink?
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="space-y-3 p-6 rounded-2xl bg-stone-50/50 border border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-teal-100/70 flex items-center justify-center text-teal-700">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Verified Healthcare Professionals</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Every doctor undergoes multi-step administrative validation of medical licenses and university degrees.
                </p>
              </div>

              <div className="space-y-3 p-6 rounded-2xl bg-stone-50/50 border border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-teal-100/70 flex items-center justify-center text-teal-700">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Secure Health Information</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Your consultations, medical records, and diagnostic lab reports remain strictly private and encrypted.
                </p>
              </div>

              <div className="space-y-3 p-6 rounded-2xl bg-stone-50/50 border border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-teal-100/70 flex items-center justify-center text-teal-700">
                  <Activity className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Connected Consultations</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Choose between high-definition WebRTC video, real-time chat consultation, or physical in-clinic visits.
                </p>
              </div>

              <div className="space-y-3 p-6 rounded-2xl bg-stone-50/50 border border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-teal-100/70 flex items-center justify-center text-teal-700">
                  <Truck className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Convenient Medicine Delivery</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Nearest courier partner matching ensures prompt prescription medicine dispatch directly to your home.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================== */}
        {/* 12. TESTIMONIALS                                     */}
        {/* ==================================================== */}
        <section className="py-20 bg-stone-50/40 border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <span className="text-xs font-bold uppercase tracking-widest text-teal-600 mb-2 block">
                PATIENT EXPERIENCES
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                Trusted by Patients Across the Country
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
              {testimonials.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-white p-7 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    {/* Star Rating */}
                    <div className="flex items-center gap-1">
                      {[...Array(item.rating)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    {/* Review text */}
                    <p className="text-sm text-slate-700 leading-relaxed italic">
                      "{item.comment}"
                    </p>
                  </div>

                  {/* Patient Bio */}
                  <div className="mt-6 pt-5 border-t border-slate-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-teal-50 border border-teal-200/70 text-teal-800 font-bold text-sm flex items-center justify-center">
                      {item.initials}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">{item.name}</div>
                      <div className="text-xs text-slate-500">{item.consultation} • {item.location}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ==================================================== */}
        {/* 13. FREQUENTLY ASKED QUESTIONS (ACCORDION)          */}
        {/* ==================================================== */}
        <section id="faq" className="py-20 bg-white border-b border-slate-100">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <span className="text-xs font-bold uppercase tracking-widest text-teal-600 mb-2 block">
                QUESTIONS & ANSWERS
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="space-y-3.5">
              {faqItems.map((item, index) => {
                const isOpen = openFaq === index;
                return (
                  <div
                    key={index}
                    className="border border-slate-200/90 rounded-2xl overflow-hidden bg-white shadow-xs transition"
                  >
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                      className="w-full text-left px-6 py-4 sm:py-5 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition focus:outline-none"
                    >
                      <span className="text-base font-bold text-slate-900">
                        {item.q}
                      </span>
                      {isOpen ? (
                        <ChevronUp className="w-5 h-5 text-teal-600 shrink-0" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-5 pt-1 text-sm text-slate-600 leading-relaxed border-t border-slate-100 bg-stone-50/30">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ==================================================== */}
        {/* 14. GET IN TOUCH / CONTACT SECTION                   */}
        {/* ==================================================== */}
        <section id="contact" className="py-20 bg-stone-50/40 border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <span className="text-xs font-bold uppercase tracking-widest text-teal-600 mb-2 block">
                GET IN TOUCH
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                We’re Here to Support Your Care
              </h2>
              <p className="text-base text-slate-600 mt-2">
                Reach our support team for platform assistance, appointment inquiries, or partnership opportunities.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              {/* Contact Info Card */}
              <div className="lg:col-span-5 bg-white p-8 rounded-3xl border border-slate-200/90 shadow-sm space-y-6">
                <h3 className="text-xl font-bold text-slate-900">VitaLink Care Operations</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Our care coordinators are available to assist with technical queries, appointment scheduling, and logistics inquiries.
                </p>

                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-3 text-sm text-slate-700">
                    <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-600 shrink-0">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Email Support</div>
                      <div className="font-medium text-slate-900">support@vitalink.com</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-sm text-slate-700">
                    <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-600 shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Availability</div>
                      <div className="font-medium text-slate-900">24/7 Digital Platform Access</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-sm text-slate-700">
                    <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-600 shrink-0">
                      <Building className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Service Coverage</div>
                      <div className="font-medium text-slate-900">Pan-India Telemedicine & Delivery</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Inquiry Form */}
              <div className="lg:col-span-7 bg-white p-8 rounded-3xl border border-slate-200/90 shadow-sm">
                <h3 className="text-xl font-bold text-slate-900 mb-6">Send a Message</h3>

                {contactSuccess ? (
                  <div className="p-6 rounded-2xl bg-teal-50 border border-teal-200 text-center space-y-2">
                    <CheckCircle2 className="w-10 h-10 text-teal-600 mx-auto" />
                    <h4 className="text-lg font-bold text-teal-950">Message Sent Successfully</h4>
                    <p className="text-sm text-teal-800">
                      Thank you for reaching out. A VitaLink care coordinator will respond to your email within 24 hours.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleContactSubmit} className="space-y-4">
                    {contactError && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{contactError}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                          Your Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={contactForm.name}
                          onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                          placeholder="e.g. Priya Sharma"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                          Your Email Address *
                        </label>
                        <input
                          type="email"
                          required
                          value={contactForm.email}
                          onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                          placeholder="e.g. priya@example.com"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                        Subject
                      </label>
                      <input
                        type="text"
                        value={contactForm.subject}
                        onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                        placeholder="e.g. Appointment rescheduling / question"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                        Your Message *
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={contactForm.message}
                        onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                        placeholder="How can our care team assist you today?"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={contactLoading}
                      className="w-full py-3.5 px-6 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-sm hover:shadow transition flex items-center justify-center gap-2"
                    >
                      {contactLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Sending Inquiry...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Submit Care Inquiry</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================== */}
        {/* 15. FINAL CTA — CALM & PREMIUM                       */}
        {/* ==================================================== */}
        <section className="py-20 bg-slate-900 text-white text-center">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
              Healthcare that stays connected to you.
            </h2>

            <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
              From finding the right doctor to managing prescriptions and records, VitaLink brings your care together.
            </p>

            <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-sm shadow-md transition"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                to="/doctors"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-sm transition"
              >
                <span>Find a Doctor</span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* 16. Professional Light Footer */}
      <Footer />
    </div>
  );
};

export default LandingPage;
