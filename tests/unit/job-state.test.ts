import { describe, it, expect } from "vitest";
import { isTerminalState, mapJobToUploadState, type JobStatusResponse } from "@/lib/uploads/job-state";

describe("Job State Terminal Checks", () => {
  it("queued -> not terminal", () => {
    const job: JobStatusResponse = {
      id: "1",
      status: "queued",
      sourceStatus: "pending",
      currentStep: null,
      progressPercent: 0,
      error: null,
    };
    expect(isTerminalState(job)).toBe(false);
  });

  it("running -> not terminal", () => {
    const job: JobStatusResponse = {
      id: "1",
      status: "running",
      sourceStatus: "extracting",
      currentStep: "Extracting text",
      progressPercent: 15,
      error: null,
    };
    expect(isTerminalState(job)).toBe(false);
  });

  it("retrying -> not terminal", () => {
    const job: JobStatusResponse = {
      id: "1",
      status: "retrying",
      sourceStatus: "extracting",
      currentStep: "Extracting text",
      progressPercent: 15,
      error: "Temporary network issue",
    };
    expect(isTerminalState(job)).toBe(false);
  });

  it("completed -> terminal", () => {
    const job: JobStatusResponse = {
      id: "1",
      status: "completed",
      sourceStatus: "completed",
      currentStep: null,
      progressPercent: 100,
      error: null,
    };
    expect(isTerminalState(job)).toBe(true);
  });

  it("failed -> terminal", () => {
    const job: JobStatusResponse = {
      id: "1",
      status: "failed",
      sourceStatus: "failed",
      currentStep: null,
      progressPercent: 50,
      error: "Fatal API error",
    };
    expect(isTerminalState(job)).toBe(true);
  });

  it("cancelled -> terminal", () => {
    const job: JobStatusResponse = {
      id: "1",
      status: "cancelled",
      sourceStatus: "failed",
      currentStep: null,
      progressPercent: 30,
      error: null,
    };
    expect(isTerminalState(job)).toBe(true);
  });

  it("needs_ocr -> terminal", () => {
    const job: JobStatusResponse = {
      id: "1",
      status: "failed",
      sourceStatus: "needs_ocr",
      currentStep: null,
      progressPercent: 100,
      error: "No text found in PDF",
    };
    expect(isTerminalState(job)).toBe(true);
  });
});

describe("mapJobToUploadState", () => {
  it("maps needs_ocr correctly", () => {
    const job: JobStatusResponse = {
      id: "1",
      status: "failed",
      sourceStatus: "needs_ocr",
      currentStep: null,
      progressPercent: 100,
      error: "OCR error",
    };
    const state = mapJobToUploadState(job);
    expect(state.status).toBe("needs_ocr");
    expect(state.progressLabel).toContain("Needs OCR");
    expect(state.progressPercent).toBe(100);
  });

  it("maps failed correctly", () => {
    const job: JobStatusResponse = {
      id: "1",
      status: "failed",
      sourceStatus: "failed",
      currentStep: null,
      progressPercent: 40,
      error: "Network error",
    };
    const state = mapJobToUploadState(job);
    expect(state.status).toBe("failed");
    expect(state.progressLabel).toBe("Failed");
    expect(state.progressPercent).toBe(40);
    expect(state.error).toBe("Network error");
  });

  it("maps cancelled correctly", () => {
    const job: JobStatusResponse = {
      id: "1",
      status: "cancelled",
      sourceStatus: "failed",
      currentStep: null,
      progressPercent: 20,
      error: null,
    };
    const state = mapJobToUploadState(job);
    expect(state.status).toBe("failed");
    expect(state.progressLabel).toBe("Cancelled");
    expect(state.progressPercent).toBe(20);
  });

  it("maps completed correctly", () => {
    const job: JobStatusResponse = {
      id: "1",
      status: "completed",
      sourceStatus: "completed",
      currentStep: null,
      progressPercent: 100,
      error: null,
    };
    const state = mapJobToUploadState(job);
    expect(state.status).toBe("completed");
    expect(state.progressLabel).toBe("Compiled into wiki");
    expect(state.progressPercent).toBe(100);
  });

  it("maps retrying correctly", () => {
    const job: JobStatusResponse = {
      id: "1",
      status: "retrying",
      sourceStatus: "analyzing",
      currentStep: "AI",
      progressPercent: 60,
      error: "Rate limited",
    };
    const state = mapJobToUploadState(job);
    expect(state.status).toBe("retrying");
    expect(state.progressLabel).toContain("Retrying");
    expect(state.progressLabel).toContain("Rate limited");
    expect(state.progressPercent).toBe(60);
  });

  it("maps running correctly", () => {
    const job: JobStatusResponse = {
      id: "1",
      status: "running",
      sourceStatus: "analyzing",
      currentStep: "Analyzing layout",
      progressPercent: 70,
      error: null,
    };
    const state = mapJobToUploadState(job);
    expect(state.status).toBe("processing");
    expect(state.progressLabel).toBe("Analyzing layout");
    expect(state.progressPercent).toBe(70);
  });
});
