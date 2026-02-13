# 🎬 UGC Video Factory

AI-powered pipeline for generating UGC (User-Generated Content) marketing videos from product URLs.

## Architecture

```
Product URL → [Apify Scraper] → [OpenAI Vision] → [Remove.bg] → [Mistral AI] → [Vidgo] → [Shotstack] → Final Video
                  ↓                    ↓                ↓              ↓             ↓           ↓
              Product Data      Vision Analysis    Transparent    Marketing      Raw Video    Assembled
                                                    Image         Angles                      Final Video
```

## Tech Stack

- **Frontend:** Next.js 14, React 18, TypeScript, TailwindCSS, Framer Motion, Zustand
- **Pipeline:** Apify (scraping), OpenAI Vision (image analysis), Mistral AI (content), Vidgo (video gen), Shotstack (assembly), Remove.bg (background removal)

## Features

- **Self-Healing Pipeline:** Exponential backoff retries with max 3 attempts per step
- **Quality Gates:** Confidence score validation before expensive API calls (Vidgo, Shotstack)
- **Graceful Degradation:** Pipeline continues even if non-critical steps fail (e.g., background removal)
- **Real-Time Updates:** Server-Sent Events (SSE) for live pipeline progress
- **Cost Tracking:** Per-step and total cost monitoring
- **Structured Logging:** Timestamped, level-based logs for every pipeline step

## Project Structure

```
src/
├── app/
│   ├── api/pipeline/route.ts    # SSE API endpoint for pipeline execution
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Main page
│   └── globals.css              # Global styles
├── components/
│   ├── Dashboard.tsx            # Main dashboard with URL input and tab navigation
│   ├── PipelineStatus.tsx       # Step-by-step progress visualization
│   ├── JokerChat.tsx            # AI assistant chat interface
│   ├── ResultsView.tsx          # Video results and marketing angles display
│   └── LogsView.tsx             # Real-time pipeline logs viewer
└── lib/
    ├── joker.ts                 # Master pipeline orchestrator (The Joker)
    ├── store.ts                 # Zustand state management
    ├── types.ts                 # TypeScript interfaces
    ├── logger.ts                # Pipeline logger
    ├── utils.ts                 # Utility functions
    └── pipeline/
        ├── apify.ts             # Product scraping (Apify + Cheerio fallback)
        ├── vision.ts            # Image analysis (OpenAI GPT-4 Vision)
        ├── mistral.ts           # Marketing content generation (Mistral AI)
        ├── removebg.ts          # Background removal (Remove.bg)
        ├── vidgo.ts             # Video generation (Vidgo API)
        └── shotstack.ts         # Video assembly (Shotstack)
```

## Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your API keys
3. Install dependencies: `npm install`
4. Run development server: `npm run dev`
5. Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

```
APIFY_TOKEN=your_apify_token
OPENAI_API_KEY=your_openai_key
MISTRAL_API_KEY=your_mistral_key
VIDGO_API_KEY=your_vidgo_key
SHOTSTACK_API_KEY=your_shotstack_key
REMOVEBG_API_KEY=your_removebg_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Pipeline Steps

| Step | Service | Cost/Call | Fallback |
|------|---------|-----------|----------|
| Scraping | Apify + Cheerio | ~$0.01 | Cheerio direct scraping |
| Vision Analysis | OpenAI GPT-4 Vision | ~$0.03 | Basic metadata extraction |
| Background Removal | Remove.bg | ~$0.20 | Skip (use original image) |
| Content Generation | Mistral AI | ~$0.01 | OpenAI fallback |
| Video Generation | Vidgo | ~$1.00 | Quality gate prevents wasteful calls |
| Video Assembly | Shotstack | ~$0.50 | Direct video output |

## License

MIT
