import express, { Request, Response } from 'express';
import { config, validateConfig } from './config';
import { logger } from './utils/logger';
import { TranscriptService } from './services/transcript';
import { GeminiService } from './services/gemini';
import { NotionService } from './services/notion';

const app = express();
app.use(express.json());

const transcriptService = new TranscriptService();
const geminiService = new GeminiService();
const notionService = new NotionService();

// Validation middleware
const validateAuth = (req: Request, res: Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn('Auth failed: Missing or invalid header', { header: authHeader });
        return res.status(401).json({ status: 'error', error_message: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];
    if (token !== config.webhookSecret) {
        logger.warn('Auth failed: Token mismatch', { receivedLength: token.length, expectedLength: config.webhookSecret?.length });
        return res.status(401).json({ status: 'error', error_message: 'Invalid secret token' });
    }

    next();
};

app.post('/webhook/youtube-to-notion', validateAuth, async (req: Request, res: Response) => {
    const { youtube_url, notion_parent, language } = req.body;

    if (!youtube_url) {
        return res.status(400).json({ status: 'error', error_message: 'Missing youtube_url' });
    }

    logger.info('Received webhook request', { youtube_url });

    try {
        // 1. Fetch Transcript
        const { text: transcript, videoId, title } = await transcriptService.getTranscript(youtube_url);

        // 2. Generate How-To with Gemini
        const videoTitle = title || `YouTube Video ${videoId}`;
        const howToContent = await geminiService.generateHowTo(transcript, videoTitle);

        // 3. Create Notion Page
        // Determine parent config
        const parentConfig = notion_parent || {
            type: config.notion.defaultParentType,
            id: config.notion.defaultParentId
        };

        if (!parentConfig.id) {
            throw new Error('No Notion parent ID provided in request or config');
        }

        const notionResponse = await notionService.createPage(videoTitle, howToContent, parentConfig);

        logger.info('Successfully processed request', { notion_page_id: notionResponse.id });

        return res.status(200).json({
            status: 'ok',
            notion_page_id: notionResponse.id,
            notion_page_url: notionResponse.url
        });

    } catch (error: any) {
        logger.error('Error processing request', error);
        return res.status(500).json({
            status: 'error',
            error_message: error.message || 'Internal Server Error'
        });
    }
});

const startServer = () => {
    try {
        try {
            validateConfig();
        } catch (error: any) {
            logger.warn('Configuration validation failed - Application will start but may not function correctly', { error: error.message });
        }

        app.listen(config.port, () => {
            logger.info(`Server running on port ${config.port}`);
        });
    } catch (error) {
        logger.error('Failed to start server', error);
        process.exit(1);
    }
};

startServer();
