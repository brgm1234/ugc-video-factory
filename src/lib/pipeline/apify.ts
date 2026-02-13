import axios from 'axios';
import * as cheerio from 'cheerio';
import { ProductData } from '../types';

interface ApifyRunResponse {
  data: {
    id: string;
    actId: string;
    status: string;
    defaultDatasetId: string;
  };
}

interface ApifyDatasetItem {
  url?: string;
  title?: string;
  name?: string;
  price?: number | string;
  currency?: string;
  description?: string;
  ingredients?: string;
  images?: string[];
  imageUrls?: string[];
  reviews?: Array<{
    rating?: number;
    text?: string;
    author?: string;
    date?: string;
  }>;
  rating?: number;
  reviewCount?: number;
}

export class ScraperError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message);
    this.name = 'ScraperError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public missingFields: string[]) {
    super(message);
    this.name = 'ValidationError';
  }
}

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN || '';
const APIFY_ACTOR_ID = process.env.APIFY_ACTOR_ID || 'apify/web-scraper';
const APIFY_BASE_URL = 'https://api.apify.com/v2';
const APIFY_COST_PER_CALL = 0.01;

let totalCost = 0;

export function getTotalCost(): number {
  return totalCost;
}

export function resetCostTracking(): void {
  totalCost = 0;
}

function isAmazonUrl(url: string): boolean {
  return /amazon\.(com|co\.uk|de|fr|it|es|ca|com\.mx|com\.br|in|cn|co\.jp|com\.au)/i.test(url);
}

async function scrapeWithApify(url: string): Promise<ProductData> {
  if (!APIFY_API_TOKEN) {
    throw new ScraperError('Apify API token not configured', 'MISSING_TOKEN');
  }

  const runUrl = `${APIFY_BASE_URL}/acts/${APIFY_ACTOR_ID}/runs`;
  const headers = {
    'Authorization': `Bearer ${APIFY_API_TOKEN}`,
    'Content-Type': 'application/json',
  };

  const isAmazon = isAmazonUrl(url);
  const actorId = isAmazon ? 'junglee/amazon-product-scraper' : APIFY_ACTOR_ID;

  const input = isAmazon
    ? {
        startUrls: [{ url }],
        maxItems: 1,
        proxyConfiguration: { useApifyProxy: true },
      }
    : {
        startUrls: [{ url }],
        maxRequestsPerCrawl: 1,
        pageFunction: `async function pageFunction(context) {
          const { page, request } = context;
          const title = await page.$eval('h1', el => el.textContent.trim()).catch(() => '');
          const price = await page.$eval('[itemprop="price"], .price, .product-price', el => el.textContent.trim()).catch(() => '');
          const description = await page.$eval('[itemprop="description"], .description, .product-description', el => el.textContent.trim()).catch(() => '');
          const images = await page.$$eval('img[src*="product"], .product-image img', imgs => imgs.map(img => img.src)).catch(() => []);
          return { title, price, description, images, url: request.url };
        }`,
      };

  try {
    const runResponse = await axios.post<ApifyRunResponse>(
      runUrl,
      input,
      { headers, timeout: 60000 }
    );

    const runId = runResponse.data.data.id;
    const datasetId = runResponse.data.data.defaultDatasetId;

    await waitForRunCompletion(runId);

    const datasetUrl = `${APIFY_BASE_URL}/datasets/${datasetId}/items`;
    const datasetResponse = await axios.get<ApifyDatasetItem[]>(datasetUrl, {
      headers,
      params: { format: 'json' },
    });

    if (!datasetResponse.data || datasetResponse.data.length === 0) {
      throw new ScraperError('No data returned from Apify', 'EMPTY_DATASET');
    }

    totalCost += APIFY_COST_PER_CALL;

    const item = datasetResponse.data[0];
    return transformApifyData(item, url);
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      throw new ScraperError(
        `Apify API error: ${error.message}`,
        'APIFY_API_ERROR',
        { status: error.response?.status, data: error.response?.data }
      );
    }
    throw error;
  }
}

async function waitForRunCompletion(runId: string, maxWaitTime = 120000): Promise<void> {
  const startTime = Date.now();
  const pollInterval = 2000;

  while (Date.now() - startTime < maxWaitTime) {
    const statusUrl = `${APIFY_BASE_URL}/actor-runs/${runId}`;
    const response = await axios.get(statusUrl, {
      headers: { 'Authorization': `Bearer ${APIFY_API_TOKEN}` },
    });

    const status = response.data.data.status;

    if (status === 'SUCCEEDED') {
      return;
    }

    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      throw new ScraperError(`Apify run ${status.toLowerCase()}`, 'RUN_FAILED', { status });
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new ScraperError('Apify run timeout', 'RUN_TIMEOUT');
}

function transformApifyData(item: ApifyDatasetItem, url: string): ProductData {
  const name = item.title || item.name || '';
  const priceValue = typeof item.price === 'string' ? parsePrice(item.price) : item.price || 0;
  const images = item.images || item.imageUrls || [];
  const description = item.description || '';
  const ingredients = item.ingredients || '';

  const reviews = item.reviews?.map(r => ({
    rating: r.rating || 0,
    text: r.text || '',
    author: r.author || 'Anonymous',
    date: r.date || new Date().toISOString(),
  })) || [];

  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : item.rating || 0;

  return {
    url,
    name,
    price: priceValue,
    currency: item.currency || 'USD',
    description,
    ingredients,
    images,
    reviews,
    rating: averageRating,
    reviewCount: item.reviewCount || reviews.length,
    scrapedAt: new Date().toISOString(),
    source: 'apify',
  };
}

function parsePrice(priceString: string): number {
  const cleaned = priceString.replace(/[^0-9.,]/g, '');
  const normalized = cleaned.replace(',', '.');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}

async function scrapeWithAxios(url: string): Promise<ProductData> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 30000,
    });

    const $ = cheerio.load(response.data);

    const name = extractName($);
    const price = extractPrice($);
    const currency = extractCurrency($);
    const description = extractDescription($);
    const ingredients = extractIngredients($);
    const images = extractImages($, url);
    const { reviews, rating, reviewCount } = extractReviews($);

    return {
      url,
      name,
      price,
      currency,
      description,
      ingredients,
      images,
      reviews,
      rating,
      reviewCount,
      scrapedAt: new Date().toISOString(),
      source: 'direct',
    };
  } catch (error: any) {
    throw new ScraperError(
      `Direct scraping failed: ${error.message}`,
      'DIRECT_SCRAPE_ERROR',
      { url }
    );
  }
}

function extractName($: cheerio.CheerioAPI): string {
  const selectors = [
    'h1[itemprop="name"]',
    'h1.product-title',
    'h1.product-name',
    '[data-test="product-title"]',
    '#productTitle',
    'h1',
  ];

  for (const selector of selectors) {
    const text = $(selector).first().text().trim();
    if (text) return text;
  }

  return '';
}

function extractPrice($: cheerio.CheerioAPI): number {
  const selectors = [
    '[itemprop="price"]',
    '.price',
    '.product-price',
    '[data-test="product-price"]',
    '#priceblock_ourprice',
    '#priceblock_dealprice',
    '.a-price-whole',
  ];

  for (const selector of selectors) {
    const text = $(selector).first().text().trim();
    if (text) {
      const price = parsePrice(text);
      if (price > 0) return price;
    }
  }

  return 0;
}

function extractCurrency($: cheerio.CheerioAPI): string {
  const currencySymbols: Record<string, string> = {
    '$': 'USD',
    'â¬': 'EUR',
    'Â£': 'GBP',
    'Â¥': 'JPY',
    'â¹': 'INR',
  };

  const priceText = $('.price, [itemprop="price"]').first().text();
  for (const [symbol, code] of Object.entries(currencySymbols)) {
    if (priceText.includes(symbol)) return code;
  }

  const currencyMeta = $('meta[itemprop="priceCurrency"]').attr('content');
  if (currencyMeta) return currencyMeta;

  return 'USD';
}

function extractDescription($: cheerio.CheerioAPI): string {
  const selectors = [
    '[itemprop="description"]',
    '.product-description',
    '#productDescription',
    '.description',
    '[data-test="product-description"]',
  ];

  for (const selector of selectors) {
    const text = $(selector).first().text().trim();
    if (text && text.length > 20) return text;
  }

  return '';
}

function extractIngredients($: cheerio.CheerioAPI): string {
  const selectors = [
    '[itemprop="ingredients"]',
    '.ingredients',
    '#ingredients',
    '[data-test="ingredients"]',
    '.product-ingredients',
  ];

  for (const selector of selectors) {
    const text = $(selector).first().text().trim();
    if (text) return text;
  }

  return '';
}

function extractImages($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const images = new Set<string>();
  const selectors = [
    '[itemprop="image"]',
    '.product-image img',
    '#landingImage',
    '.gallery-image img',
    '[data-test="product-image"]',
  ];

  for (const selector of selectors) {
    $(selector).each((_, elem) => {
      const src = $(elem).attr('src') || $(elem).attr('data-src');
      if (src) {
        const absoluteUrl = src.startsWith('http') ? src : new URL(src, baseUrl).href;
        if (!absoluteUrl.includes('placeholder') && !absoluteUrl.includes('spacer')) {
          images.add(absoluteUrl);
        }
      }
    });
  }

  return Array.from(images).slice(0, 10);
}

function extractReviews($: cheerio.CheerioAPI): {
  reviews: Array<{ rating: number; text: string; author: string; date: string }>;
  rating: number;
  reviewCount: number;
} {
  const reviews: Array<{ rating: number; text: string; author: string; date: string }> = [];

  $('.review, [itemprop="review"]').slice(0, 10).each((_, elem) => {
    const $review = $(elem);
    const ratingText = $review.find('[itemprop="ratingValue"], .rating, .stars').first().text();
    const rating = parseFloat(ratingText) || 5;
    const text = $review.find('[itemprop="reviewBody"], .review-text, .review-content').first().text().trim();
    const author = $review.find('[itemprop="author"], .review-author').first().text().trim() || 'Anonymous';
    const date = $review.find('[itemprop="datePublished"], .review-date').first().text().trim() || new Date().toISOString();

    if (text) {
      reviews.push({ rating, text, author, date });
    }
  });

  const ratingText = $('[itemprop="ratingValue"], .average-rating, .rating-value').first().text();
  const rating = parseFloat(ratingText) || 0;

  const reviewCountText = $('[itemprop="reviewCount"], .review-count').first().text();
  const reviewCount = parseInt(reviewCountText.replace(/\D/g, '')) || reviews.length;

  return { reviews, rating, reviewCount };
}

export function validateProductData(data: ProductData): { isValid: boolean; score: number; missingFields: string[] } {
  const requiredFields: Array<{ key: keyof ProductData; weight: number }> = [
    { key: 'name', weight: 2 },
    { key: 'price', weight: 2 },
    { key: 'description', weight: 1.5 },
    { key: 'images', weight: 1.5 },
    { key: 'ingredients', weight: 1 },
    { key: 'reviews', weight: 1 },
    { key: 'rating', weight: 1 },
  ];

  const missingFields: string[] = [];
  let totalWeight = 0;
  let achievedWeight = 0;

  for (const field of requiredFields) {
    totalWeight += field.weight;
    const value = data[field.key];

    if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
      missingFields.push(field.key);
    } else {
      if (field.key === 'description' && typeof value === 'string' && value.length < 20) {
        achievedWeight += field.weight * 0.5;
      } else if (field.key === 'images' && Array.isArray(value) && value.length < 2) {
        achievedWeight += field.weight * 0.5;
      } else {
        achievedWeight += field.weight;
      }
    }
  }

  const score = Math.round((achievedWeight / totalWeight) * 10);
  const isValid = score >= 6 && data.name !== '' && data.price > 0;

  return { isValid, score, missingFields };
}

export async function scrapeProduct(url: string): Promise<ProductData> {
  if (!url || typeof url !== 'string') {
    throw new ScraperError('Invalid URL provided', 'INVALID_URL');
  }

  try {
    new URL(url);
  } catch {
    throw new ScraperError('Malformed URL', 'MALFORMED_URL');
  }

  let productData: ProductData;
  let useApify = true;

  if (!APIFY_API_TOKEN) {
    useApify = false;
  }

  try {
    if (useApify) {
      productData = await scrapeWithApify(url);
    } else {
      productData = await scrapeWithAxios(url);
    }
  } catch (error) {
    if (useApify && error instanceof ScraperError) {
      console.warn(`Apify scraping failed: ${error.message}. Falling back to direct scraping.`);
      try {
        productData = await scrapeWithAxios(url);
      } catch (fallbackError: any) {
        throw new ScraperError(
          'Both Apify and direct scraping failed',
          'ALL_METHODS_FAILED',
          { apifyError: error.message, directError: fallbackError.message }
        );
      }
    } else {
      throw error;
    }
  }

  const validation = validateProductData(productData);

  if (!validation.isValid) {
    throw new ValidationError(
      `Product data validation failed (score: ${validation.score}/10)`,
      validation.missingFields
    );
  }

  return productData;
}