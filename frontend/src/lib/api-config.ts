// API Configuration - Automatically switches between local and deployed backend
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const API = {
  symptoms: `${API_BASE_URL}/api/symptoms`,
  skin: `${API_BASE_URL}/api/skin`,
  metrics: `${API_BASE_URL}/api/metrics`,
  chat: `${API_BASE_URL}/api/chat`,
  feedback: `${API_BASE_URL}/api/feedback`,
  appointments: `${API_BASE_URL}/api/appointments`,
};
