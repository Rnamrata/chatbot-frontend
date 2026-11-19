import { InjectionToken } from '@angular/core';

/** The Flask server (llm-chatbot). The UI never calls the review service on :4000 directly. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => 'http://localhost:5001',
});