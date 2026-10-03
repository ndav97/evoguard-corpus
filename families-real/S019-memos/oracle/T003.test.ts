// Tests ocultos del estudio.
import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { getAttachmentMetadata } from "@/components/MemoMetadata/Attachment/attachmentHelpers";
import { AttachmentSchema } from "@/types/proto/api/v1/attachment_service_pb";
import { getFileTypeLabel } from "@/utils/format";

// T003 — Extensión del nombre cuando el tipo MIME no sirve.
describe("T003 · etiqueta a partir del nombre del archivo", () => {
  it("sin tipo MIME usa la extensión en mayúsculas", () => {
    expect(getFileTypeLabel("", "notes.md")).toBe("MD");
    expect(getFileTypeLabel("", "report.final.Pdf")).toBe("PDF");
  });

  it("application/octet-stream también usa la extensión", () => {
    expect(getFileTypeLabel("application/octet-stream", "backup.tar.gz")).toBe("GZ");
    expect(getFileTypeLabel("application/octet-stream; foo=bar", "data.bin")).toBe("BIN");
  });

  it("sin extensión útil la etiqueta es File", () => {
    expect(getFileTypeLabel("", "README")).toBe("File");
    expect(getFileTypeLabel("application/octet-stream", ".env")).toBe("File");
    expect(getFileTypeLabel("application/octet-stream", "archive.")).toBe("File");
    expect(getFileTypeLabel("application/octet-stream")).toBe("File");
    expect(getFileTypeLabel("")).toBe("File");
  });

  it("con un tipo MIME útil se ignora el nombre", () => {
    expect(getFileTypeLabel("application/pdf", "photo.jpg")).toBe("PDF");
    expect(getFileTypeLabel("text/csv", "data.txt")).toBe("CSV");
  });

  it("los metadatos de un adjunto usan el nombre del archivo", () => {
    const attachment = create(AttachmentSchema, {
      name: "attachments/1",
      filename: "slides.key",
      type: "application/octet-stream",
      size: BigInt(2048),
    });
    expect(getAttachmentMetadata(attachment)).toEqual({ fileTypeLabel: "KEY", fileSizeLabel: "2.0 KB" });
  });
});
