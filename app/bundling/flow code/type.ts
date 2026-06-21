export type Category =
    | 'Perfume'
    | 'Lipstick'
    | 'Eyeliner'
    | 'Foundation'
    | 'Moisturizer'
    | 'Serum'
    | 'Face Mask'
    | 'Palette'
    | 'Other';

export interface ProductDimensions {
    lengthCm: number;
    widthCm: number;
    heightCm: number;
    weightG: number;
    volumeMl: number;
}

export interface Product extends ProductDimensions {
    id: string;
    name: string;
    category: Category;
    base64: string;
    mimeType: string;
    uploadedUrl?: string;
    // Layout properties
    x: number;
    y: number;
    rotation: number;
    scale: number;
    zIndex: number;
    isAnalyzing?: boolean;
}

export interface GeneratedResult {
    id: string;
    base64?: string;
    mimeType?: string;
    timestamp: number;
    imageUrl?: string;
    name?: string;
}