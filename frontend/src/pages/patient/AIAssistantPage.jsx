import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import {
  Sparkles,
  Send,
  PlusCircle,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  Stethoscope,
  Info,
  Clock,
  ArrowRight,
  User,
  Activity,
  CheckCircle2,
  ChevronRight,
  MessageSquare,
  Home
} from 'lucide-react';

const SUGGESTIONS = [
  'I feel very hot and have fever chills.',
  'I feel weak, tired, and dizzy.',
  'I have a persistent dry cough and chest tightness.',
  'Sharp lower back pain after lifting something heavy.',
  'Red itchy skin rash on my arms for 2 days.'
];

export const AIAssistantPage = () => {
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const messagesEndRef = useRef(null);

  // Fetch all conversation threads for the patient
  const fetchConversations = async () => {
    try {
      const res = await apiClient.get('/ai/conversations');
      if (res.data?.success) {
        setConversations(res.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    }
  };

  // Fetch full message thread for a selected conversation
  const loadConversation = async (convId) => {
    if (!convId) return;
    setLoadingHistory(true);
    setError(null);
    try {
      const res = await apiClient.get(`/ai/conversations/${convId}`);
      if (res.data?.success) {
        setCurrentConversation(res.data.data.conversation);
        setMessages(res.data.data.messages || []);
        setActiveConversationId(convId);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load conversation history.');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const handleStartNewAssessment = () => {
    setActiveConversationId(null);
    setCurrentConversation(null);
    setMessages([]);
    setError(null);
    setInputText('');
  };

  const handleDeleteConversation = async (e, convId) => {
    e.stopPropagation();
    if (!window.confirm('Delete this assessment record?')) return;
    try {
      await apiClient.delete(`/ai/conversations/${convId}`);
      setConversations((prev) => prev.filter((c) => c._id !== convId));
      if (activeConversationId === convId) {
        handleStartNewAssessment();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete assessment.');
    }
  };

  const handleSendMessage = async (customText = null) => {
    const textToSend = customText || inputText;
    if (!textToSend || !textToSend.trim() || sending) return;

    setError(null);
    const userPrompt = textToSend.trim();
    setInputText('');
    setSending(true);

    // Optimistically show user message
    const tempUserMsg = {
      _id: 'temp-' + Date.now(),
      sender: 'patient',
      message: userPrompt,
      createdAt: new Date().toISOString()
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await apiClient.post('/ai/chat', {
        conversationId: activeConversationId || undefined,
        message: userPrompt
      });

      if (res.data?.success) {
        const { conversation, userMessage, assistantMessage } = res.data.data;

        // Replace temp message with server-persisted user message
        setMessages((prev) => [
          ...prev.filter((m) => m._id !== tempUserMsg._id),
          userMessage,
          assistantMessage
        ]);

        if (!activeConversationId) {
          setActiveConversationId(conversation.id);
          setCurrentConversation(conversation);
          fetchConversations();
        } else {
          setCurrentConversation((prev) => ({
            ...prev,
            suggestedSpecialty: conversation.suggestedSpecialty,
            lastMessageAt: conversation.lastMessageAt
          }));
        }
      }
    } catch (err) {
      const serverCode = err.response?.data?.code;
      const serverMsg = err.response?.data?.message;

      if (serverCode === 'AI_CONFIG_ERROR' || serverCode === 'AI_SERVICE_ERROR') {
        setError(
          serverMsg || 'The AI Health Assistant is currently unconfigured or unavailable. Please contact your system administrator.'
        );
      } else {
        setError(serverMsg || 'Failed to generate clinical assessment. Please try again.');
      }
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <DashboardLayout title="AI Health Assistant">
      <div className="max-w-7xl mx-auto flex flex-col h-[calc(100vh-8.5rem)]">
        {/* Top Mandatory Clinical Disclaimer Banner */}
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 px-4 mb-4 flex items-start gap-3 shadow-xs shrink-0">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold">Medical Disclaimer: </span>
            VitaLink AI provides general health information and triage guidance for educational purposes and does not replace a qualified healthcare professional.
            In case of emergency, call <span className="font-bold text-rose-700">112 / 108 / 911</span> or proceed to the nearest emergency department immediately.
          </div>
        </div>

        {/* Main Work Area: 2-Column Split */}
        <div className="flex-1 flex bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          {/* Left Column: Conversation Thread History */}
          <div
            className={`w-72 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0 ${
              sidebarOpen ? 'block fixed inset-0 z-40 bg-white' : 'hidden md:flex'
            }`}
          >
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-sky-600" />
                <span>Past Assessments</span>
              </div>
              <button
                onClick={handleStartNewAssessment}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 transition"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>New</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {conversations.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No past assessments yet.
                </div>
              ) : (
                conversations.map((conv) => {
                  const isActive = conv._id === activeConversationId;
                  return (
                    <div
                      key={conv._id}
                      onClick={() => {
                        loadConversation(conv._id);
                        setSidebarOpen(false);
                      }}
                      className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition ${
                        isActive
                          ? 'bg-sky-100 text-sky-900 font-bold'
                          : 'text-slate-700 hover:bg-slate-200/60'
                      }`}
                    >
                      <div className="truncate flex-1 mr-2">
                        <div className="truncate">{conv.title || 'Health Assessment'}</div>
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{new Date(conv.lastMessageAt || conv.createdAt).toLocaleDateString()}</span>
                          {conv.suggestedSpecialty && (
                            <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 truncate">
                              {conv.suggestedSpecialty}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteConversation(e, conv._id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-1 transition"
                        title="Delete assessment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Active Chat & Assessment Display */}
          <div className="flex-1 flex flex-col min-w-0 bg-white">
            {/* Header */}
            <div className="h-14 px-6 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="md:hidden text-xs text-slate-600 font-semibold px-2 py-1 bg-slate-100 rounded"
                >
                  History
                </button>
                <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 truncate">
                    {currentConversation?.title || 'VitaLink Clinical AI Assistant'}
                  </h3>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2">
                    <span>Powered by Clinical Triage Engine</span>
                    {currentConversation?.suggestedSpecialty && (
                      <span className="text-teal-700 font-medium">
                        • Rec: {currentConversation.suggestedSpecialty}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {currentConversation?.suggestedSpecialty && (
                <Link
                  to={`/doctors?specialization=${encodeURIComponent(currentConversation.suggestedSpecialty)}`}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition"
                >
                  <Stethoscope className="w-3.5 h-3.5" />
                  <span>Consult {currentConversation.suggestedSpecialty}</span>
                </Link>
              )}
            </div>

            {/* Error Alert Bar */}
            {error && (
              <div className="p-3 px-6 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="flex-1">{error}</span>
                <button onClick={() => setError(null)} className="text-rose-600 font-bold hover:underline">
                  Dismiss
                </button>
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
              {/* Initial Welcome Message if no messages */}
              {messages.length === 0 && (
                <div className="max-w-2xl mx-auto py-8 text-center space-y-4">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-sky-600 to-teal-500 text-white flex items-center justify-center shadow-md">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">How can I assist your health today?</h2>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      Describe your symptoms, discomfort, or health queries in natural language. VitaLink AI will analyze them, identify possible concerns, outline safe guidance, and connect you with qualified doctors.
                    </p>
                  </div>

                  {/* Suggestion Chips */}
                  <div className="pt-2">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Suggested Inquiries:
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      {SUGGESTIONS.map((sug, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSendMessage(sug)}
                          className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 text-xs hover:border-sky-500 hover:text-sky-600 transition shadow-2xs text-left"
                        >
                          "{sug}"
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Message List */}
              {messages.map((msg, index) => {
                const isPatient = msg.sender === 'patient';
                const data = msg.structuredData;

                if (isPatient) {
                  return (
                    <div key={msg._id || index} className="flex justify-end">
                      <div className="max-w-xl flex items-start gap-3 flex-row-reverse">
                        <div className="w-8 h-8 rounded-full bg-sky-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                        <div className="bg-sky-600 text-white p-3.5 px-4 rounded-2xl rounded-tr-none text-xs leading-relaxed shadow-xs">
                          {msg.message}
                        </div>
                      </div>
                    </div>
                  );
                }

                // AI Assistant Structured Message
                return (
                  <div key={msg._id || index} className="flex justify-start">
                    <div className="max-w-2xl w-full flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-1 shadow-xs">
                        <Sparkles className="w-4 h-4" />
                      </div>

                      <div className="flex-1 bg-white border border-slate-200 rounded-2xl rounded-tl-none p-5 text-xs shadow-xs space-y-4">
                        {/* Emergency Banner if Urgent */}
                        {data?.urgent && (
                          <div className="bg-rose-50 border-2 border-rose-500 rounded-xl p-3.5 text-rose-900 flex items-start gap-3">
                            <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5 animate-pulse" />
                            <div>
                              <div className="font-bold text-sm text-rose-700">
                                Urgent Medical Concern Detected
                              </div>
                              <p className="text-xs mt-1 text-rose-800">
                                Your reported symptoms may require immediate emergency medical care. Do not wait or drive yourself. Call local emergency services (112 / 108 / 911) or proceed immediately to the nearest hospital emergency room.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Summary */}
                        {data?.summary && (
                          <div>
                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                              Clinical Assessment Summary
                            </div>
                            <div className="text-slate-800 leading-relaxed font-medium bg-slate-50 p-3 rounded-xl border border-slate-100">
                              {data.summary}
                            </div>
                          </div>
                        )}

                        {/* Possible Concerns */}
                        {data?.possibleConcerns?.length > 0 && (
                          <div>
                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                              Possible Concerns / Etiologies
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {data.possibleConcerns.map((concern, cIdx) => (
                                <span
                                  key={cIdx}
                                  className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 border border-sky-200 font-medium"
                                >
                                  {concern}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Primary Solutions / What You Can Do At Home */}
                        {data?.primarySolutions?.length > 0 && (
                          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 text-emerald-950">
                            <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              <Home className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>PRIMARY SOLUTIONS / WHAT YOU CAN DO AT HOME</span>
                            </div>
                            <ol className="space-y-2 text-slate-800">
                              {data.primarySolutions.map((solution, sIdx) => (
                                <li key={sIdx} className="flex items-start gap-2.5 leading-relaxed">
                                  <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                                    {sIdx + 1}
                                  </span>
                                  <span className="font-medium text-slate-800">{solution}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}

                        {/* General Guidance & Self-Care */}
                        {data?.generalGuidance?.length > 0 && (
                          <div>
                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                              General Guidance & Comfort Measures
                            </div>
                            <ul className="space-y-1.5">
                              {data.generalGuidance.map((guidance, gIdx) => (
                                <li key={gIdx} className="flex items-start gap-2 text-slate-700">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                                  <span>{guidance}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Warning Signs */}
                        {data?.warningSigns?.length > 0 && (
                          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-amber-900">
                            <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              <span>Warning Signs Requiring Prompt Escalation</span>
                            </div>
                            <ul className="space-y-1 mt-1 text-slate-700">
                              {data.warningSigns.map((warning, wIdx) => (
                                <li key={wIdx} className="flex items-start gap-1.5">
                                  <span className="text-amber-600 font-bold">•</span>
                                  <span>{warning}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Recommended Specialty & Direct Booking */}
                        {data?.recommendedSpecialty && (
                          <div className="bg-teal-50 border border-teal-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <div className="text-[10px] font-bold text-teal-800 uppercase tracking-wider">
                                Recommended Specialist Consultation
                              </div>
                              <div className="font-bold text-slate-900 text-sm mt-0.5">
                                {data.recommendedSpecialty}
                              </div>
                              <div className="text-[11px] text-slate-600">
                                Qualified doctors are available for in-person or telemedicine appointments.
                              </div>
                            </div>
                            <Link
                              to={`/doctors?specialization=${encodeURIComponent(data.recommendedSpecialty)}`}
                              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-600 text-white font-semibold text-xs hover:bg-teal-700 transition shrink-0"
                            >
                              <span>Find Doctors</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        )}

                        {/* Mandatory Disclaimer on each structured card */}
                        <div className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-100">
                          {msg.disclaimer ||
                            'VitaLink AI provides general health information and does not replace a qualified healthcare professional.'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Sending / Processing indicator */}
              {sending && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl rounded-tl-none p-4 shadow-xs">
                    <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold animate-pulse">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="text-xs text-slate-600">
                      Analyzing symptoms with clinical AI engine...
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-4 bg-white border-t border-slate-200 shrink-0">
              <div className="flex items-center gap-2 max-w-4xl mx-auto">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe your symptoms naturally (e.g., 'I feel weak and tired' or 'Throat pain for 2 days')..."
                  disabled={sending}
                  className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 placeholder:text-slate-400 disabled:opacity-50"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim() || sending}
                  className="px-5 py-3 rounded-xl bg-sky-600 text-white text-xs font-bold flex items-center gap-2 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-xs"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AIAssistantPage;
