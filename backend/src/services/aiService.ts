/**
 * AI Service for Complaint Description Improvement
 * 
 * Uses Google Gemini API to rewrite complaint descriptions to be:
 * - Clear and well-structured
 * - Professional in tone
 * - Polite and respectful
 * - Actionable for government officials
 */

import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const GEMINI_API_KEY = process.env.GOOGLE_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('⚠️ GOOGLE_API_KEY not found. AI description improvement will not work.');
}

// Initialize Gemini with new SDK
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

/**
 * Prompt template for improving complaint descriptions
 */
const IMPROVEMENT_PROMPT = `You are an expert assistant helping citizens communicate with government officials about civic issues.

Your task is to rewrite the given complaint description to be:
1. CLEAR: Well-structured, easy to understand, with proper grammar and punctuation
2. PROFESSIONAL: Formal tone appropriate for official communication
3. POLITE: Respectful and constructive, avoiding accusatory or aggressive language
4. ACTIONABLE: Include specific details that help officials understand and address the issue

IMPORTANT RULES:
- Preserve ALL factual information (locations, dates, times, specific details)
- Do NOT add information that wasn't in the original
- Do NOT remove any key details from the original
- Keep the improved version concise but complete
- Use proper English grammar and spelling
- Format with paragraphs if the content is substantial
- If the original mentions urgency, maintain that sense appropriately
- Do NOT include any preamble like "Here is the improved version" - just provide the rewritten text

SECTOR/CATEGORY: {sector}
TITLE: {title}

ORIGINAL DESCRIPTION:
{description}

IMPROVED DESCRIPTION:`;

/**
 * Result of the AI improvement
 */
export interface ImproveDescriptionResult {
  success: boolean;
  improvedDescription?: string;
  error?: string;
  processingTimeMs: number;
}

/**
 * Improves a complaint description using Google Gemini
 */
export async function improveDescription(
  description: string,
  title: string = '',
  sector: string = ''
): Promise<ImproveDescriptionResult> {
  const startTime = Date.now();

  // Validate inputs
  if (!description || description.trim().length === 0) {
    return {
      success: false,
      error: 'Description is required',
      processingTimeMs: Date.now() - startTime,
    };
  }

  if (description.trim().length < 10) {
    return {
      success: false,
      error: 'Description is too short. Please provide more details.',
      processingTimeMs: Date.now() - startTime,
    };
  }

  if (description.trim().length > 5000) {
    return {
      success: false,
      error: 'Description is too long. Maximum 5000 characters allowed.',
      processingTimeMs: Date.now() - startTime,
    };
  }

  // Check if Gemini is available
  if (!ai) {
    return {
      success: false,
      error: 'AI service is not configured. Please contact support.',
      processingTimeMs: Date.now() - startTime,
    };
  }

  try {
    // Build the prompt
    const prompt = IMPROVEMENT_PROMPT
      .replace('{sector}', sector || 'General')
      .replace('{title}', title || 'Not provided')
      .replace('{description}', description.trim());

    console.log('🤖 AI Service: Generating improved description...');
    console.log('   Description length:', description.trim().length);
    console.log('   Sector:', sector || 'General');
    console.log('   Title:', title || 'Not provided');

    // Use Gemini 3 Pro Preview with new SDK
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      config: {
        temperature: 0.4,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    });

    const improvedText = response.text || '';

    console.log('✅ AI Service: Generation successful');
    console.log('   Improved length:', improvedText.trim().length);

    if (!improvedText || improvedText.trim().length === 0) {
      console.error('❌ AI Service: Empty response from Gemini');
      return {
        success: false,
        error: 'AI generated empty response. Please try again.',
        processingTimeMs: Date.now() - startTime,
      };
    }

    return {
      success: true,
      improvedDescription: improvedText.trim(),
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error: any) {
    console.error('❌ AI Service Error Details:');
    console.error('   Error type:', error.constructor.name);
    console.error('   Error message:', error.message);
    console.error('   Error code:', error.code);
    console.error('   Full error:', error);
    
    // Log response details if available
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', error.response.data);
    }

    // Handle specific error types
    if (error.message?.includes('SAFETY')) {
      return {
        success: false,
        error: 'The description contains content that cannot be processed. Please revise and try again.',
        processingTimeMs: Date.now() - startTime,
      };
    }

    if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
      return {
        success: false,
        error: 'Service is temporarily busy. Please try again in a few moments.',
        processingTimeMs: Date.now() - startTime,
      };
    }

    if (error.message?.includes('API key')) {
      return {
        success: false,
        error: 'API key configuration error. Please contact support.',
        processingTimeMs: Date.now() - startTime,
      };
    }

    return {
      success: false,
      error: `Failed to improve description: ${error.message || 'Unknown error'}`,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Check if AI service is available
 */
export function isAIServiceAvailable(): boolean {
  return ai !== null;
}

/**
 * Get AI service health status
 */
export function getAIServiceHealth(): { available: boolean; model: string } {
  return {
    available: ai !== null,
    model: 'gemini-3-pro-preview',
  };
}
