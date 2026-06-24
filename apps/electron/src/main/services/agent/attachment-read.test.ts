import { describe, expect, test } from "vitest";
import { readAttachmentForTool } from "./attachment-read";

const PDF_FIXTURE = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 68 >>
stream
BT /F1 24 Tf 100 700 Td (REFLECTA_PDF_ATTACHMENT_CONTENT) Tj ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000241 00000 n 
0000000311 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
429
%%EOF`;

function dataUrl(mediaType: string, body: Buffer | string) {
  return `data:${mediaType};base64,${Buffer.from(body).toString("base64")}`;
}

describe("readAttachmentForTool", () => {
  test("extracts text from a PDF attachment data URL", async () => {
    await expect(
      readAttachmentForTool(
        [
          {
            type: "file",
            mediaType: "application/pdf",
            filename: "fixture.pdf",
            url: dataUrl("application/pdf", PDF_FIXTURE),
            providerMetadata: { reflecta: { attachmentId: "att-pdf" } },
          },
        ],
        { attachmentId: "att-pdf" },
      ),
    ).resolves.toMatchObject({
      attachmentId: "att-pdf",
      filename: "fixture.pdf",
      mediaType: "application/pdf",
      kind: "pdf",
      content: expect.stringContaining("REFLECTA_PDF_ATTACHMENT_CONTENT"),
      totalPages: 1,
      truncated: false,
    });
  });

  test("extracts text attachment content by attachmentId", async () => {
    await expect(
      readAttachmentForTool(
        [
          {
            type: "file",
            mediaType: "text/plain",
            filename: "note.txt",
            url: dataUrl("text/plain", "plain attachment body"),
            providerMetadata: { reflecta: { attachmentId: "att-text" } },
          },
        ],
        { attachmentId: "att-text" },
      ),
    ).resolves.toMatchObject({
      attachmentId: "att-text",
      kind: "text",
      content: "plain attachment body",
      truncated: false,
    });
  });

  test("returns an error for binary attachments", async () => {
    await expect(
      readAttachmentForTool(
        [
          {
            type: "file",
            mediaType: "image/png",
            filename: "image.png",
            url: dataUrl("image/png", Buffer.from([0, 1, 2, 3, 4, 255])),
            providerMetadata: { reflecta: { attachmentId: "att-image" } },
          },
        ],
        { attachmentId: "att-image" },
      ),
    ).resolves.toMatchObject({
      attachmentId: "att-image",
      kind: "binary",
      error: expect.stringContaining("二进制"),
    });
  });
});
