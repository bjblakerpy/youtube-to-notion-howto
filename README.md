# YouTube to Notion How-To Generator

A Google Cloud Run service that turns YouTube videos into detailed Notion how-to guides using Gemini.

## Features

- **Webhook Trigger**: Accepts YouTube URLs via HTTPS POST.
- **Transcript Fetching**: Automatically retrieves video transcripts and metadata using Supadata.
- **Gemini AI Analysis**: Transforms transcripts into structured, step-by-step guides.
- **Notion Integration**: Creates formatted pages in your Notion workspace.
- **Secure**: Uses Bearer token authentication for the webhook.

## Architecture

1. **Trigger**: POST request to `/webhook/youtube-to-notion`
2. **Process**:
   - Fetch video transcript (and title via oEmbed).
   - Send transcript to Google Gemini Pro with a specialized system prompt.
   - Parse Gemini's markdown output into Notion blocks.
3. **Output**: Creates a new page in the configured Notion database/page.

## Setup

### Prerequisites

- Google Cloud Project with billing enabled.
- [Google Gemini API Key](https://aistudio.google.com/app/apikey)
- [Notion Integration Token](https://www.notion.so/my-integrations) (and share your target page/database with the integration 'bot').
- [Supadata API Key](https://supadata.ai)
- `gcloud` CLI installed and authenticated.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Service port (default 8080) |
| `WEBHOOK_SECRET` | Secret token for securing the webhook (you generate this) |
| `GEMINI_API_KEY` | Your Google Gemini API key |
| `NOTION_API_KEY` | Your Notion Integration Secret |
| `SUPADATA_API_KEY` | Your [Supadata](https://supadata.ai) API key |
| `NOTION_DEFAULT_PARENT_ID` | ID of the default parent Page or Database in Notion |
| `NOTION_DEFAULT_PARENT_TYPE` | `database` or `page` |

## Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   Fill in your API keys and secrets in `.env`.

3. **Run locally**:
   ```bash
   npm run build
   npm start
   ```

## Deployment

### Deploy to Cloud Run

1. Make the deploy script executable:
   ```bash
   chmod +x deploy.sh
   ```

2. Run the deployment script:
   ```bash
   ./deploy.sh
   ```

3. Set the environment variables in the Google Cloud Console (Cloud Run > Edit & Deploy New Revision > Variables).
   *Note: Ensure `SUPADATA_API_KEY` does not have leading/trailing whitespace.*

## Usage


Send a POST request to your deployed service URL:

```bash
curl -X POST https://YOUR-SERVICE-URL.run.app/webhook/youtube-to-notion \
  -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "notion_parent": { 
      "type": "page", 
      "id": "YOUR_NOTION_PAGE_ID" 
    }
  }'
```

Response:
```json
{
  "status": "ok",
  "notion_page_id": "...",
  "notion_page_url": "https://notion.so/..."
}
```

## Troubleshooting

- **"Transcripts are disabled"**: Some videos do not have captions. The service cannot process these.
- **"Gemini returned empty response"**: Check your API key limits or try a different video.
- **Notion 404**: Ensure you have shared the target Page/Database with your Integration (add connection).
