import dotenv from 'dotenv';

dotenv.config();

export const config = {
    port: process.env.PORT || 8080,
    webhookSecret: process.env.WEBHOOK_SECRET?.trim(),
    supadataApiKey: process.env.SUPADATA_API_KEY?.trim(),
    gemini: {
        apiKey: process.env.GEMINI_API_KEY?.trim(),
        model: 'gemini-2.0-flash',
    },
    notion: {
        apiKey: process.env.NOTION_API_KEY?.trim(),
        defaultParentId: process.env.NOTION_DEFAULT_PARENT_ID,
        defaultParentType: process.env.NOTION_DEFAULT_PARENT_TYPE || 'database', // 'database' or 'page'
    },
};

export const validateConfig = () => {
    const missing = [];
    if (!config.webhookSecret) missing.push('WEBHOOK_SECRET');
    if (!config.gemini.apiKey) missing.push('GEMINI_API_KEY');
    if (!config.notion.apiKey) missing.push('NOTION_API_KEY');
    if (!config.supadataApiKey) missing.push('SUPADATA_API_KEY');

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
};
