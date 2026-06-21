import { Category, ProductDimensions } from './types';

export const CATEGORIES: Category[] = [
    'Perfume',
    'Lipstick',
    'Eyeliner',
    'Foundation',
    'Moisturizer',
    'Serum',
    'Face Mask',
    'Palette',
    'Other'
];

export const DEFAULT_METRICS: Record<Category, ProductDimensions> = {
    'Perfume': { lengthCm: 6, widthCm: 4, heightCm: 12, weightG: 280, volumeMl: 50 },
    'Lipstick': { lengthCm: 2, widthCm: 2, heightCm: 7.5, weightG: 25, volumeMl: 4 },
    'Eyeliner': { lengthCm: 1, widthCm: 1, heightCm: 14, weightG: 12, volumeMl: 1.5 },
    'Foundation': { lengthCm: 4, widthCm: 4, heightCm: 10, weightG: 150, volumeMl: 30 },
    'Moisturizer': { lengthCm: 7, widthCm: 7, heightCm: 6, weightG: 180, volumeMl: 50 },
    'Serum': { lengthCm: 3.5, widthCm: 3.5, heightCm: 11, weightG: 95, volumeMl: 30 },
    'Face Mask': { lengthCm: 12, widthCm: 0.2, heightCm: 16, weightG: 30, volumeMl: 25 },
    'Palette': { lengthCm: 15, widthCm: 10, heightCm: 1.2, weightG: 120, volumeMl: 0 },
    'Other': { lengthCm: 10, widthCm: 10, heightCm: 10, weightG: 100, volumeMl: 0 },
};

export const INITIAL_PX_PER_CM = 25;

export function lookupLocalCatalog(fileName: string): { name: string; category: Category; metrics: ProductDimensions } {
    const lower = fileName.toLowerCase();
    const cleanName = fileName.replace(/[_-]/g, ' ').replace(/\.[^/.]+$/, '').trim();

    // 1. Direct SKU/Product matches
    if (lower.includes('rausch') && (lower.includes('shampoo') || lower.includes('conditioner'))) {
        return {
            name: 'RAUSCH Shampoo',
            category: 'Other',
            metrics: { lengthCm: 4.0, widthCm: 6.5, heightCm: 18.0, weightG: 230, volumeMl: 200 }
        };
    }
    if (lower.includes('rausch') && (lower.includes('tincture') || lower.includes('haartinktur') || lower.includes('tonic'))) {
        return {
            name: 'RAUSCH Haartinktur',
            category: 'Other',
            metrics: { lengthCm: 3.5, widthCm: 6.0, heightCm: 16.5, weightG: 220, volumeMl: 200 }
        };
    }
    if (lower.includes('k7l') && (lower.includes('pencil') || lower.includes('lip') || lower.includes('eye'))) {
        return {
            name: 'K7L Lip Pencil',
            category: 'Eyeliner',
            metrics: { lengthCm: 0.8, widthCm: 0.8, heightCm: 13.0, weightG: 12, volumeMl: 1.5 }
        };
    }
    if (lower.includes('kiss') && lower.includes('lash')) {
        return {
            name: 'KISS Trio Lashes',
            category: 'Other',
            metrics: { lengthCm: 1.5, widthCm: 10.5, heightCm: 8.5, weightG: 25, volumeMl: 0 }
        };
    }

    // 2. Category keyword matches
    if (lower.includes('perfume') || lower.includes('fragrance') || lower.includes('cologne') || lower.includes('scent')) {
        return { name: cleanName, category: 'Perfume', metrics: DEFAULT_METRICS['Perfume'] };
    }
    if (lower.includes('lipstick') || lower.includes('lip') || lower.includes('gloss')) {
        return { name: cleanName, category: 'Lipstick', metrics: DEFAULT_METRICS['Lipstick'] };
    }
    if (lower.includes('eyeliner') || lower.includes('pencil') || lower.includes('liner') || lower.includes('mascara')) {
        return { name: cleanName, category: 'Eyeliner', metrics: DEFAULT_METRICS['Eyeliner'] };
    }
    if (lower.includes('foundation') || lower.includes('concealer') || lower.includes('cushion')) {
        return { name: cleanName, category: 'Foundation', metrics: DEFAULT_METRICS['Foundation'] };
    }
    if (lower.includes('moisturizer') || lower.includes('cream') || lower.includes('lotion') || lower.includes('gel')) {
        return { name: cleanName, category: 'Moisturizer', metrics: DEFAULT_METRICS['Moisturizer'] };
    }
    if (lower.includes('serum') || lower.includes('dropper') || lower.includes('ampoule')) {
        return { name: cleanName, category: 'Serum', metrics: DEFAULT_METRICS['Serum'] };
    }
    if (lower.includes('mask') || lower.includes('sheet')) {
        return { name: cleanName, category: 'Face Mask', metrics: DEFAULT_METRICS['Face Mask'] };
    }
    if (lower.includes('palette') || lower.includes('shadow')) {
        return { name: cleanName, category: 'Palette', metrics: DEFAULT_METRICS['Palette'] };
    }

    // Default fallback
    return {
        name: cleanName,
        category: 'Other',
        metrics: DEFAULT_METRICS['Other']
    };
}