// Tests ocultos del estudio.
import { describe, expect, it } from "vitest";
import { getFileTypeLabel } from "@/utils/format";

// T002 — Etiquetas legibles para documentos de oficina, Markdown y CSV.
describe("T002 · getFileTypeLabel para documentos", () => {
  it("documentos de Word, Excel y PowerPoint", () => {
    expect(getFileTypeLabel("application/msword")).toBe("DOC");
    expect(getFileTypeLabel("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("DOCX");
    expect(getFileTypeLabel("application/vnd.ms-excel")).toBe("XLS");
    expect(getFileTypeLabel("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe("XLSX");
    expect(getFileTypeLabel("application/vnd.ms-powerpoint")).toBe("PPT");
    expect(getFileTypeLabel("application/vnd.openxmlformats-officedocument.presentationml.presentation")).toBe("PPTX");
  });

  it("Markdown y CSV, con mayúsculas y parámetros", () => {
    expect(getFileTypeLabel("text/markdown")).toBe("MD");
    expect(getFileTypeLabel("Text/CSV; charset=utf-8")).toBe("CSV");
  });

  it("los tipos ya conocidos no cambian", () => {
    expect(getFileTypeLabel("application/pdf")).toBe("PDF");
    expect(getFileTypeLabel("image/svg+xml")).toBe("SVG");
    expect(getFileTypeLabel("video/quicktime")).toBe("MOV");
    expect(getFileTypeLabel("text/plain")).toBe("TXT");
  });
});
