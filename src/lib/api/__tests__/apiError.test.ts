import { describe, it, expect } from "vitest";
import { ApiError, isApiError } from "@/lib/api/apiError";

describe("ApiError", () => {
  it("creates error with code and message", () => {
    const err = new ApiError({ code: "NOT_FOUND", message: "Resource not found", httpStatus: 404 });
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("Resource not found");
    expect(err.httpStatus).toBe(404);
  });

  it("serializes to JSON", () => {
    const err = new ApiError({ code: "SERVER_ERROR", message: "Internal error", httpStatus: 500 });
    const json = err.toJSON();
    expect(json.code).toBe("SERVER_ERROR");
    expect(json.httpStatus).toBe(500);
  });

  it("isApiError returns true for ApiError instances", () => {
    const err = new ApiError({ code: "UNKNOWN_ERROR", message: "test" });
    expect(isApiError(err)).toBe(true);
  });

  it("isApiError returns false for regular errors", () => {
    expect(isApiError(new Error("test"))).toBe(false);
    expect(isApiError("string")).toBe(false);
  });

  it("ApiError.from wraps TypeError as NETWORK_ERROR", () => {
    const err = ApiError.from(new TypeError("Failed to fetch"));
    expect(err.code).toBe("NETWORK_ERROR");
  });
});
