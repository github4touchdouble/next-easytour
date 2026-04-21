import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// @testing-library/react does not auto-clean under vitest. Without
// this, every `render()` leaves its container in the document, and
// the next test sees doubled elements — `getByTestId` fails with
// "multiple matches".
afterEach(() => {
  cleanup();
});