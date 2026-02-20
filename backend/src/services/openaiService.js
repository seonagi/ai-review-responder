// OpenAI Service for AI-powered review response generation
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Model selection (GPT-3.5-turbo for cost-efficiency, GPT-4 for quality)
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';

/**
 * Generate a response to a review based on rating and content
 * @param {Object} review - Review object from database
 * @param {Object} brandVoice - Brand voice settings (optional)
 * @returns {Promise<Object>} Generated response text and metadata
 */
async function generateResponse(review, brandVoice = null) {
  const { rating, review_text, reviewer_name } = review;
  
  // Build the prompt based on review sentiment
  const prompt = buildPrompt(rating, review_text, reviewer_name, brandVoice);
  
  try {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: 'system',
          content: getSystemPrompt(brandVoice)
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7, // Creative but not too random
      max_tokens: 200, // Keep responses concise
      presence_penalty: 0.3, // Encourage variety
      frequency_penalty: 0.3, // Reduce repetition
    });

    const responseText = completion.choices[0].message.content.trim();
    
    return {
      text: responseText,
      model: DEFAULT_MODEL,
      tokens: completion.usage.total_tokens,
      finishReason: completion.choices[0].finish_reason
    };
  } catch (error) {
    console.error('OpenAI API error:', error);
    
    // Handle specific errors
    if (error.status === 429) {
      throw new Error('Rate limit exceeded. Please try again in a moment.');
    }
    if (error.status === 401) {
      throw new Error('Invalid OpenAI API key. Please check configuration.');
    }
    if (error.status === 500) {
      throw new Error('OpenAI service temporarily unavailable. Please try again later.');
    }
    
    throw new Error(`Failed to generate response: ${error.message}`);
  }
}

/**
 * Build the system prompt based on brand voice
 * @param {Object} brandVoice - Brand voice settings
 * @returns {string} System prompt
 */
function getSystemPrompt(brandVoice) {
  const baseTone = brandVoice?.tone || 'friendly and professional';
  const customInstructions = brandVoice?.custom_instructions || '';
  
  return `You are an AI assistant helping restaurant owners respond to Google reviews.

Your goal is to write responses that:
- Sound genuinely human and personalized
- Match the business's brand voice (${baseTone})
- Are concise but warm (2-4 sentences maximum)
- Address specific details from the review when mentioned
- Encourage customers to return

${customInstructions ? `Additional guidelines: ${customInstructions}` : ''}

Important:
- Never use generic templates or corporate jargon
- Don't over-apologize or sound defensive
- Keep responses brief and natural
- Match the tone to the review's sentiment`;
}

/**
 * Build the user prompt based on review details
 * @param {number} rating - Review rating (1-5 stars)
 * @param {string} reviewText - Review content
 * @param {string} reviewerName - Name of reviewer
 * @param {Object} brandVoice - Brand voice settings
 * @returns {string} User prompt
 */
function buildPrompt(rating, reviewText, reviewerName, brandVoice) {
  const reviewerFirstName = reviewerName ? reviewerName.split(' ')[0] : 'there';
  
  // Customize prompt based on rating
  if (rating >= 4) {
    // Positive review (4-5 stars)
    return `Write a warm response to this ${rating}-star review from ${reviewerFirstName}.

Review: "${reviewText || 'Great experience!'}"

The response should:
- Thank ${reviewerFirstName} sincerely
- Reference specific positive details they mentioned (if any)
- Invite them to visit again
- Be brief and genuine (2-3 sentences)

Do not use phrases like "we're so glad" or "it means the world to us" - keep it natural and conversational.`;
  } else if (rating === 3) {
    // Mixed review (3 stars)
    return `Write a thoughtful response to this 3-star review from ${reviewerFirstName}.

Review: "${reviewText || 'It was okay.'}"

The response should:
- Thank ${reviewerFirstName} for their feedback
- Acknowledge both positive and constructive points (if mentioned)
- Show commitment to improvement
- Keep it professional but warm (2-4 sentences)

Don't be overly apologetic - show you value their input and want to do better.`;
  } else {
    // Negative review (1-2 stars)
    return `Write an empathetic response to this ${rating}-star review from ${reviewerFirstName}.

Review: "${reviewText || 'Not happy with the experience.'}"

The response should:
- Apologize sincerely for their poor experience
- Acknowledge their specific complaint (if mentioned)
- Offer to make it right (invite them to contact you directly)
- Be professional but genuinely caring (3-4 sentences)

Important: Don't make excuses or sound defensive. Show you truly care about fixing the issue.`;
  }
}

/**
 * Validate if we have a valid OpenAI API key
 * @returns {boolean} True if API key is configured
 */
function hasValidApiKey() {
  return !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-');
}

/**
 * Simple rate limiter (in-memory)
 * In production, use Redis or a proper rate limiting service
 */
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 requests per minute per user

function checkRateLimit(userId) {
  const now = Date.now();
  const userKey = `user:${userId}`;
  
  if (!rateLimitStore.has(userKey)) {
    rateLimitStore.set(userKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  
  const userData = rateLimitStore.get(userKey);
  
  // Reset if window has passed
  if (now > userData.resetAt) {
    rateLimitStore.set(userKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  
  // Check if limit exceeded
  if (userData.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((userData.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }
  
  // Increment counter
  userData.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - userData.count };
}

module.exports = {
  generateResponse,
  hasValidApiKey,
  checkRateLimit,
};
