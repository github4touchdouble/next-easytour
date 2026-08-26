/**
 * Save endpoint for the tutorial editor.
 *
 * The demo page uses a localStorage draft, so it does not call this — it
 * is here to show the shape a real app uses:
 *
 *   store: httpStore("/tour.json", { saveTo: "/api/tutorial" })
 *
 * With no `authorize` function, writes are denied outside development.
 * Supply one to let an authenticated admin save from a deployed site:
 *
 *   authorize: async (req) => (await getSession(req))?.role === "admin",
 */

import { createTutorialFileRoute } from "next-easytour/server";

export const { GET, POST } = createTutorialFileRoute({
  file: "public/tour.json",
  read: true,
});
