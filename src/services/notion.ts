import { Client } from '@notionhq/client';
import { config } from '../config';
import { logger } from '../utils/logger';

const notion = new Client({ auth: config.notion.apiKey });

export class NotionService {
    /**
     * Helper to parse inline markdown (bold, italic, code) into Notion rich_text objects.
     */
    private parseRichText(text: string): any[] {
        const richText: any[] = [];
        let currentText = text;

        // Simple parser for **bold**, *italic*, and `code`
        // This is not a full markdown parser but covers the basics for this use case.
        // We used a regex split approach.

        // Regex to capture **bold**, *italic*, `code` without consuming delimiters in non-matching parts
        const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
        const parts = currentText.split(regex);

        for (const part of parts) {
            if (!part) continue;

            if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
                richText.push({
                    type: 'text',
                    text: { content: part.slice(2, -2) },
                    annotations: { bold: true }
                });
            } else if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
                // Check if it's not part of **bold** (though split should handle it, edge cases exist)
                richText.push({
                    type: 'text',
                    text: { content: part.slice(1, -1) },
                    annotations: { italic: true }
                });
            } else if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
                richText.push({
                    type: 'text',
                    text: { content: part.slice(1, -1) },
                    annotations: { code: true }
                });
            } else {
                richText.push({
                    type: 'text',
                    text: { content: part },
                });
            }
        }

        return richText;
    }

    /**
     * Converts a markdown string into Notion block objects.
     */
    private markdownToBlocks(markdown: string): any[] {
        const lines = markdown.split('\n');
        const blocks: any[] = [];
        let inCodeBlock = false;
        let codeBlockLanguage = 'plain text';
        let codeBlockContent: string[] = [];

        for (const line of lines) {
            // Handle Code Blocks
            if (line.trim().startsWith('```')) {
                if (inCodeBlock) {
                    // End of code block
                    blocks.push({
                        object: 'block',
                        type: 'code',
                        code: {
                            rich_text: [{ type: 'text', text: { content: codeBlockContent.join('\n') } }],
                            language: codeBlockLanguage.toLowerCase() || 'plain text'
                        }
                    });
                    inCodeBlock = false;
                    codeBlockContent = [];
                    codeBlockLanguage = 'plain text';
                } else {
                    // Start of code block
                    inCodeBlock = true;
                    const lang = line.trim().substring(3).trim();
                    codeBlockLanguage = lang === '' ? 'plain text' : lang;
                }
                continue;
            }

            if (inCodeBlock) {
                codeBlockContent.push(line);
                continue;
            }

            const trimmed = line.trim();
            if (!trimmed) continue;

            if (trimmed.startsWith('# ')) {
                blocks.push({
                    object: 'block',
                    type: 'heading_1',
                    heading_1: {
                        rich_text: [{ type: 'text', text: { content: trimmed.substring(2) } }],
                    },
                });
            } else if (trimmed.startsWith('## ')) {
                blocks.push({
                    object: 'block',
                    type: 'heading_2',
                    heading_2: {
                        rich_text: [{ type: 'text', text: { content: trimmed.substring(3) } }],
                    },
                });
            } else if (trimmed.startsWith('### ')) {
                blocks.push({
                    object: 'block',
                    type: 'heading_3',
                    heading_3: {
                        rich_text: [{ type: 'text', text: { content: trimmed.substring(4) } }],
                    },
                });
            } else if (trimmed.startsWith('- ')) {
                blocks.push({
                    object: 'block',
                    type: 'bulleted_list_item',
                    bulleted_list_item: {
                        rich_text: this.parseRichText(trimmed.substring(2)),
                    },
                });
            } else if (/^\d+\.\s/.test(trimmed)) {
                const content = trimmed.replace(/^\d+\.\s/, '');
                blocks.push({
                    object: 'block',
                    type: 'numbered_list_item',
                    numbered_list_item: {
                        rich_text: this.parseRichText(content),
                    },
                });
            } else if (trimmed.startsWith('> ')) {
                blocks.push({
                    object: 'block',
                    type: 'quote',
                    quote: {
                        rich_text: this.parseRichText(trimmed.substring(2)),
                    }
                });
            } else {
                blocks.push({
                    object: 'block',
                    type: 'paragraph',
                    paragraph: {
                        rich_text: this.parseRichText(trimmed),
                    },
                });
            }
        }
        return blocks;
    }

    /**
     * Creates a new page in Notion.
     */
    async createPage(
        title: string,
        contentMarkdown: string,
        parentConfig?: { type: 'database' | 'page'; id: string }
    ): Promise<{ id: string; url: string }> {

        const parentType = parentConfig?.type || config.notion.defaultParentType;
        const parentId = parentConfig?.id || config.notion.defaultParentId;

        if (!parentId) {
            throw new Error('No Notion parent ID provided');
        }

        logger.info('Creating Notion page', { title, parentType, parentId });

        const children = this.markdownToBlocks(contentMarkdown);

        // Extract the title from the first line if it's a heading, otherwise use the provided title
        let pageTitle = title;
        const firstLine = contentMarkdown.split('\n')[0].trim();
        if (firstLine.startsWith('# ')) {
            pageTitle = firstLine.substring(2);
            // Remove the title from the body if we are using it as the page title
            if (children.length > 0 && children[0].type === 'heading_1') {
                children.shift();
            }
        }


        const parent: any = {};
        if (parentType === 'database') {
            parent.database_id = parentId;
        } else {
            parent.page_id = parentId;
        }

        const properties: any = {};
        if (parentType === 'database') {
            // For databases, title property name varies, usually "Name" or "Title"
            // We'll assume "Name" as standard, but this might need adjustment based on specific DB schema
            properties['Name'] = {
                title: [{ text: { content: pageTitle } }],
            };
        } else {
            // Pages create via 'children' don't use properties for title in the same way during creation 
            // if it's a child definition, but top-level create requires properties for DB items.
            // For 'page' parent, we specify title in properties as well?
            // Actually, for creating a page as a child of another page, 'title' property is used.
            properties['title'] = {
                title: [{ text: { content: pageTitle } }],
            };
        }

        try {
            logger.info('Sending request to Notion API', {
                parent,
                properties: JSON.stringify(properties),
                childrenCount: children.length
            });

            const response = await notion.pages.create({
                parent: parent,
                properties: properties,
                children: children,
            });

            logger.info('Notion page created successfully', {
                id: response.id,
                url: (response as any).url
            });

            return { id: response.id, url: (response as any).url };
        } catch (error: any) {
            logger.error('Failed to create Notion page', {
                message: error.message,
                code: error.code,
                status: error.status,
                body: error.body
            });
            throw error;
        }
    }
}
