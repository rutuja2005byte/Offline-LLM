declare module "pdf-parse/lib/pdf-parse" {
  type PdfParseResult = {
    text: string;
    numpages: number;
    numrender: number;
    info?: unknown;
    metadata?: unknown;
    version?: string;
  };

  export default function pdf(dataBuffer: Buffer): Promise<PdfParseResult>;
}
