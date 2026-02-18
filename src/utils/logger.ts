export const logger = {
    info: (message: string, meta?: any) => {
        console.log(JSON.stringify({ level: 'info', message, ...meta, timestamp: new Date().toISOString() }));
    },
    error: (message: string, error?: any) => {
        console.error(JSON.stringify({ level: 'error', message, error: error?.message || error, stack: error?.stack, timestamp: new Date().toISOString() }));
    },
    warn: (message: string, meta?: any) => {
        console.warn(JSON.stringify({ level: 'warn', message, ...meta, timestamp: new Date().toISOString() }));
    },
};
