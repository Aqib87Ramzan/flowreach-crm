export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  status: 'New' | 'Contacted' | 'Replied' | 'Converted';
  notes: string;
  dateAdded: string;
}

export interface SMSRecord {
  id: string;
  leadName: string;
  message: string;
  status: 'Sent' | 'Failed' | 'Pending';
  timeSent: string;
}

export interface EmailRecord {
  id: string;
  leadName: string;
  subject: string;
  status: 'Sent' | 'Failed' | 'Pending';
  timeSent: string;
}

const LEADS_KEY = 'flowreach_leads';
const SMS_KEY = 'flowreach_sms';
const EMAIL_KEY = 'flowreach_emails';
const AUTH_KEY = 'flowreach_auth';

const defaultLeads: Lead[] = [
  { id: '1', name: 'Sarah Johnson', email: 'sarah@example.com', phone: '+1 555-0101', source: 'Facebook', status: 'New', notes: 'Interested in premium plan', dateAdded: '2026-03-28' },
  { id: '2', name: 'Michael Chen', email: 'michael@example.com', phone: '+1 555-0102', source: 'Instagram', status: 'Contacted', notes: 'Follow up next week', dateAdded: '2026-03-27' },
  { id: '3', name: 'Emily Rodriguez', email: 'emily@example.com', phone: '+1 555-0103', source: 'Website', status: 'Replied', notes: 'Requested demo', dateAdded: '2026-03-26' },
  { id: '4', name: 'James Wilson', email: 'james@example.com', phone: '+1 555-0104', source: 'LinkedIn', status: 'Converted', notes: 'Signed up for annual plan', dateAdded: '2026-03-25' },
  { id: '5', name: 'Olivia Brown', email: 'olivia@example.com', phone: '+1 555-0105', source: 'Facebook', status: 'New', notes: '', dateAdded: '2026-03-24' },
  { id: '6', name: 'David Kim', email: 'david@example.com', phone: '+1 555-0106', source: 'Google Ads', status: 'Contacted', notes: 'Price sensitive', dateAdded: '2026-03-23' },
  { id: '7', name: 'Sophia Martinez', email: 'sophia@example.com', phone: '+1 555-0107', source: 'Instagram', status: 'New', notes: 'Found through influencer campaign', dateAdded: '2026-03-22' },
  { id: '8', name: 'Daniel Lee', email: 'daniel@example.com', phone: '+1 555-0108', source: 'Referral', status: 'Replied', notes: 'Referred by James Wilson', dateAdded: '2026-03-21' },
];

const defaultSMS: SMSRecord[] = [
  { id: '1', leadName: 'Sarah Johnson', message: 'Hi Sarah! Thanks for your interest in FlowReach.', status: 'Sent', timeSent: '2026-03-28 10:30' },
  { id: '2', leadName: 'Michael Chen', message: 'Hi Michael, just following up on our conversation.', status: 'Sent', timeSent: '2026-03-27 14:15' },
  { id: '3', leadName: 'Emily Rodriguez', message: 'Emily, your demo is scheduled for tomorrow!', status: 'Sent', timeSent: '2026-03-26 09:00' },
];

const defaultEmails: EmailRecord[] = [
  { id: '1', leadName: 'Sarah Johnson', subject: 'Welcome to FlowReach!', status: 'Sent', timeSent: '2026-03-28 10:00' },
  { id: '2', leadName: 'James Wilson', subject: 'Your Annual Plan Confirmation', status: 'Sent', timeSent: '2026-03-25 16:00' },
  { id: '3', leadName: 'David Kim', subject: 'Special Pricing Just For You', status: 'Sent', timeSent: '2026-03-23 11:30' },
];

function getFromStorage<T>(key: string, defaults: T[]): T[] {
  const stored = localStorage.getItem(key);
  if (!stored) {
    localStorage.setItem(key, JSON.stringify(defaults));
    return defaults;
  }
  return JSON.parse(stored);
}

function saveToStorage<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

export function getLeads(): Lead[] {
  return getFromStorage(LEADS_KEY, defaultLeads);
}

export function addLead(lead: Omit<Lead, 'id' | 'dateAdded'>): Lead {
  const leads = getLeads();
  const newLead: Lead = {
    ...lead,
    id: Date.now().toString(),
    dateAdded: new Date().toISOString().split('T')[0],
  };
  leads.unshift(newLead);
  saveToStorage(LEADS_KEY, leads);
  return newLead;
}

export function deleteLead(id: string) {
  const leads = getLeads().filter(l => l.id !== id);
  saveToStorage(LEADS_KEY, leads);
}

export function getSMSHistory(): SMSRecord[] {
  return getFromStorage(SMS_KEY, defaultSMS);
}

export function addSMS(record: Omit<SMSRecord, 'id'>): SMSRecord {
  const records = getSMSHistory();
  const newRecord: SMSRecord = { ...record, id: Date.now().toString() };
  records.unshift(newRecord);
  saveToStorage(SMS_KEY, records);
  return newRecord;
}

export function getEmailHistory(): EmailRecord[] {
  return getFromStorage(EMAIL_KEY, defaultEmails);
}

export function addEmail(record: Omit<EmailRecord, 'id'>): EmailRecord {
  const records = getEmailHistory();
  const newRecord: EmailRecord = { ...record, id: Date.now().toString() };
  records.unshift(newRecord);
  saveToStorage(EMAIL_KEY, records);
  return newRecord;
}

export function login(email: string, _password: string): boolean {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ email, token: 'mock-jwt-token-' + Date.now() }));
  return true;
}

export function register(email: string, _password: string): boolean {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ email, token: 'mock-jwt-token-' + Date.now() }));
  return true;
}

export function getAuth(): { email: string; token: string } | null {
  const stored = localStorage.getItem(AUTH_KEY);
  return stored ? JSON.parse(stored) : null;
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
}
