/**
 * Experiment B: Response Quality Validation
 * 
 * Tests AI-generated responses against criteria:
 * - Does it sound human?
 * - Is it appropriate for the rating?
 * - Would you post this publicly?
 * 
 * Rating scale: 1-5 (1=terrible, 5=excellent)
 */

const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Sample reviews (mix of ratings)
const testReviews = [
  {
    id: 1,
    rating: 5,
    text: "Amazing food! The pasta was perfectly cooked and the service was outstanding. Will definitely come back!",
    reviewerName: "Sarah M."
  },
  {
    id: 2,
    rating: 5,
    text: "Best Italian restaurant in town. Great atmosphere, friendly staff, and delicious tiramisu!",
    reviewerName: "John D."
  },
  {
    id: 3,
    rating: 4,
    text: "Good food and nice ambiance. Service was a bit slow but worth the wait. Would recommend!",
    reviewerName: "Emma L."
  },
  {
    id: 4,
    rating: 3,
    text: "Food was okay. Nothing special but not bad either. Prices are a bit high for what you get.",
    reviewerName: "Michael R."
  },
  {
    id: 5,
    rating: 3,
    text: "Average experience. The pizza was decent but I've had better. Service was friendly though.",
    reviewerName: "Lisa K."
  },
  {
    id: 6,
    rating: 2,
    text: "Disappointed. Long wait time and the food came out cold. Expected much better.",
    reviewerName: "David P."
  },
  {
    id: 7,
    rating: 2,
    text: "Not worth the money. Small portions and food was bland. Won't be returning.",
    reviewerName: "Rachel S."
  },
  {
    id: 8,
    rating: 1,
    text: "Terrible experience. Rude staff, dirty tables, and the food was inedible. Avoid at all costs!",
    reviewerName: "Tom W."
  },
  {
    id: 9,
    rating: 1,
    text: "Worst restaurant I've ever been to. Food poisoning after eating here. Absolutely disgusting!",
    reviewerName: "Jennifer B."
  },
  {
    id: 10,
    rating: 5,
    text: "Incredible! Every dish was perfect. The chef came out to greet us. Truly memorable experience!",
    reviewerName: "Robert H."
  }
];

// Generate AI response for a review
async function generateResponse(review) {
  const prompt = `You are a restaurant owner responding to a customer review on Google My Business.

Review: "${review.text}"
Rating: ${review.rating}/5 stars
Reviewer: ${review.reviewerName}

Write a professional, friendly response that:
- Thanks the customer for their feedback
- Addresses specific points they mentioned
- For positive reviews: Express genuine appreciation
- For negative reviews: Acknowledge concerns, apologize if appropriate, offer to make it right
- Keep it under 100 words
- Sound human and authentic, not robotic

Response:`;

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'You are a friendly restaurant owner writing responses to Google reviews.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 200,
  });

  return completion.choices[0].message.content.trim();
}

// Manual quality rating (would be human-rated in real scenario)
function autoRateQuality(review, response) {
  // Simulated quality check (in reality, human would rate this)
  const criteria = {
    soundsHuman: 0, // 1-5
    appropriateForRating: 0, // 1-5
    wouldPost: 0, // 1-5
  };

  // Simple heuristics (not perfect, but gives initial assessment)
  const lowerResponse = response.toLowerCase();
  
  // Sounds human check
  if (lowerResponse.includes('we') || lowerResponse.includes('our')) criteria.soundsHuman += 1;
  if (!lowerResponse.includes('ai') && !lowerResponse.includes('automated')) criteria.soundsHuman += 1;
  if (lowerResponse.length > 50 && lowerResponse.length < 150) criteria.soundsHuman += 1;
  if (lowerResponse.includes('!') || lowerResponse.includes(':)')) criteria.soundsHuman += 1;
  
  // Appropriate for rating
  if (review.rating >= 4 && (lowerResponse.includes('thank') || lowerResponse.includes('appreciate'))) {
    criteria.appropriateForRating += 3;
  } else if (review.rating <= 2 && (lowerResponse.includes('sorry') || lowerResponse.includes('apologize'))) {
    criteria.appropriateForRating += 3;
  } else if (review.rating === 3 && lowerResponse.includes('thank')) {
    criteria.appropriateForRating += 2;
  }
  
  // Would post check (composite)
  criteria.wouldPost = Math.min(5, Math.floor((criteria.soundsHuman + criteria.appropriateForRating) / 2));

  return {
    soundsHuman: Math.min(5, criteria.soundsHuman),
    appropriateForRating: Math.min(5, criteria.appropriateForRating),
    wouldPost: Math.min(5, criteria.wouldPost),
    average: ((criteria.soundsHuman + criteria.appropriateForRating + criteria.wouldPost) / 3).toFixed(1)
  };
}

// Main experiment
async function runExperiment() {
  console.log('🧪 EXPERIMENT B: Response Quality Validation\n');
  console.log('Generating AI responses for 10 reviews...\n');
  console.log('='.repeat(80));

  const results = [];
  let totalSoundsHuman = 0;
  let totalAppropriate = 0;
  let totalWouldPost = 0;

  for (const review of testReviews) {
    console.log(`\n📝 Review #${review.id} (${review.rating}⭐)`);
    console.log(`Text: "${review.text}"`);
    console.log(`Reviewer: ${review.reviewerName}\n`);

    try {
      const response = await generateResponse(review);
      const quality = autoRateQuality(review, response);

      console.log(`🤖 AI Response:`);
      console.log(`"${response}"\n`);
      console.log(`📊 Quality Scores:`);
      console.log(`  - Sounds human: ${quality.soundsHuman}/5`);
      console.log(`  - Appropriate for rating: ${quality.appropriateForRating}/5`);
      console.log(`  - Would post publicly: ${quality.wouldPost}/5`);
      console.log(`  - Average: ${quality.average}/5`);
      console.log('='.repeat(80));

      results.push({
        reviewId: review.id,
        rating: review.rating,
        reviewText: review.text,
        aiResponse: response,
        quality,
      });

      totalSoundsHuman += quality.soundsHuman;
      totalAppropriate += quality.appropriateForRating;
      totalWouldPost += quality.wouldPost;

      // Rate limit (OpenAI free tier)
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`❌ Error generating response: ${error.message}`);
    }
  }

  // Summary
  console.log('\n\n📊 EXPERIMENT SUMMARY\n');
  console.log(`Total reviews tested: ${results.length}`);
  console.log(`Average "sounds human" score: ${(totalSoundsHuman / results.length).toFixed(1)}/5`);
  console.log(`Average "appropriate for rating" score: ${(totalAppropriate / results.length).toFixed(1)}/5`);
  console.log(`Average "would post" score: ${(totalWouldPost / results.length).toFixed(1)}/5`);
  console.log(`\nOverall quality: ${((totalSoundsHuman + totalAppropriate + totalWouldPost) / (results.length * 3)).toFixed(1)}/5\n`);

  // Distribution by rating
  console.log('Distribution by review rating:');
  for (let star = 1; star <= 5; star++) {
    const reviewsAtStar = results.filter(r => r.rating === star);
    if (reviewsAtStar.length > 0) {
      const avgQuality = reviewsAtStar.reduce((sum, r) => sum + parseFloat(r.quality.average), 0) / reviewsAtStar.length;
      console.log(`  ${star}⭐: ${reviewsAtStar.length} reviews, avg quality ${avgQuality.toFixed(1)}/5`);
    }
  }

  // Save results
  const fs = require('fs');
  fs.writeFileSync(
    __dirname + '/../experiments/response-quality-results.json',
    JSON.stringify(results, null, 2)
  );

  console.log('\n✅ Results saved to: experiments/response-quality-results.json\n');
}

// Run the experiment
runExperiment().catch(console.error);
