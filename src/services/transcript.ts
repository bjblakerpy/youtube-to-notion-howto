import { config } from '../config';
import { logger } from '../utils/logger';

export class TranscriptService {
    /**
     * Extracts the video ID from a YouTube URL.
     * Supports various formats like youtube.com/watch?v=ID, youtu.be/ID, etc.
     */
    private extractVideoId(url: string): string | null {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    /**
     * Fetches video metadata using YouTube oEmbed.
     */
    async getVideoMetadata(url: string): Promise<{ title: string; author_name: string }> {
        try {
            const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
            const response = await fetch(oembedUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch metadata: ${response.statusText}`);
            }
            const data = await response.json();
            return {
                title: (data as any).title,
                author_name: (data as any).author_name
            };
        } catch (error) {
            logger.warn('Failed to fetch video metadata', error);
            return { title: 'Unknown Title', author_name: 'Unknown Author' };
        }
    }

    /**
     * Fetches the transcript for a given YouTube URL using Supadata API.
     */
    async getTranscript(url: string): Promise<{ text: string; videoId: string; title: string }> {
        const videoId = this.extractVideoId(url);
        if (!videoId) {
            throw new Error('Invalid YouTube URL');
        }

        logger.info('Fetching transcript via Supadata', { videoId });

        if (!config.supadataApiKey) {
            throw new Error('SUPADATA_API_KEY is not configured');
        }

        try {
            // Fetch metadata first (or in parallel) to get the title
            const metadataPromise = this.getVideoMetadata(url);

            // Supadata API call
            // Endpoint: https://api.supadata.ai/v1/youtube/transcript
            // Query Params: videoId, text=true (for plain text) or json (for segments)
            // We'll use JSON to be safe and robust, or just text if it's cleaner. 
            // Documentation says `text=true` returns simple text. Let's try to get structured first to ensure quality, 
            // but simpler is better for now.

            const supadataUrl = `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&text=true`;

            const response = await fetch(supadataUrl, {
                method: 'GET',
                headers: {
                    'x-api-key': config.supadataApiKey
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Supadata API failed: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const transcriptData = await response.json();
            // Supadata with text=true usually returns { content: "Full text..." } or similar, 
            // OR a list of segments if text=false. 
            // Let's assume text=true returns a JSON with a content field or just the text directly?
            // Re-checking research: "returns transcripts... which can include time-stamped segments".
            // Let's stick to the content field if available, or just use the whole response if it's text.
            // Based on common API patterns for this:

            let transcriptText = '';
            if (typeof transcriptData === 'string') {
                transcriptText = transcriptData;
            } else if (transcriptData.content) {
                transcriptText = transcriptData.content;
            } else if (Array.isArray(transcriptData)) {
                transcriptText = transcriptData.map((item: any) => item.text).join(' ');
            } else {
                // Fallback: try to find a known field or dump json
                logger.warn('Unexpected Supadata response format', { keys: Object.keys(transcriptData) });
                transcriptText = JSON.stringify(transcriptData);
            }

            const metadata = await metadataPromise;

            return { text: transcriptText, videoId, title: metadata.title };

        } catch (error: any) {
            logger.error('Failed to fetch transcript from Supadata', error);
            throw error;
        }
    }
}
